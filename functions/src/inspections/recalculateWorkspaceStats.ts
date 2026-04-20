/**
 * Callable: recompute org/{orgId}/workspaces/{workspaceId}.stats from live
 * extinguishers + inspections (matches client buildLocationStatsMap + sumAllBucketStats).
 * Owner/admin only. Use when workspace.stats has drifted vs. derived counts.
 *
 * Keep logic aligned with src/utils/workspaceInspectionStats.ts (manual sync).
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwFailedPrecondition, throwNotFound } from '../utils/errors.js';

interface LooseInspection {
  id?: string;
  extinguisherId: string;
  workspaceId?: string;
  assetId: string;
  section: string;
  locationId: string | null;
  status: string;
  updatedAt?: unknown;
  inspectedAt?: unknown;
  createdAt?: unknown;
}

interface LooseExtinguisher {
  id?: string;
  assetId: string;
  section?: string;
  locationId?: string | null;
  qrCodeValue?: string;
  barcode?: string;
  serial?: string;
}

interface LooseLocation {
  id?: string;
  name: string;
  parentLocationId: string | null;
}

interface BucketStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  percentage: number;
}

function firestoreLikeToMillis(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'object' && v !== null && 'toMillis' in v) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(v);
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    const s = (v as { seconds?: number }).seconds;
    if (typeof s === 'number') return s * 1000;
  }
  return 0;
}

function inspectionActivityMs(insp: LooseInspection): number {
  for (const v of [insp.updatedAt, insp.inspectedAt, insp.createdAt]) {
    const ms = firestoreLikeToMillis(v);
    if (ms > 0) return ms;
  }
  return 0;
}

function dedupeInspectionsByExtinguisherLatest(inspections: LooseInspection[]): LooseInspection[] {
  const sorted = [...inspections].sort((a, b) => inspectionActivityMs(b) - inspectionActivityMs(a));
  const seen = new Set<string>();
  const out: LooseInspection[] = [];
  for (const insp of sorted) {
    if (seen.has(insp.extinguisherId)) continue;
    seen.add(insp.extinguisherId);
    out.push(insp);
  }
  return out;
}

function detectHasLocationIdData(
  inspections: LooseInspection[],
  extinguishers: LooseExtinguisher[],
): boolean {
  return inspections.some((insp) => insp.locationId) || extinguishers.some((ext) => ext.locationId);
}

function buildLocationStatsMap(params: {
  inspections: LooseInspection[];
  extinguishers: LooseExtinguisher[];
  locations: LooseLocation[];
  isArchived: boolean;
  hasLocationIdData: boolean;
}): Map<string, BucketStats> {
  const { inspections, extinguishers, locations, isArchived, hasLocationIdData } = params;
  const map = new Map<string, BucketStats>();

  function getStats(id: string): BucketStats {
    if (!map.has(id)) {
      map.set(id, { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 });
    }
    return map.get(id)!;
  }

  if (hasLocationIdData) {
    if (!isArchived) {
      const trackedExtIds = new Set<string>();
      for (const ext of extinguishers) {
        const locId = ext.locationId || '__unassigned__';
        const stats = getStats(locId);
        stats.total += 1;
        stats.pending += 1;
        trackedExtIds.add(ext.id!);
      }
      for (const insp of dedupeInspectionsByExtinguisherLatest(inspections)) {
        const isOrphaned = !trackedExtIds.has(insp.extinguisherId);
        const locId = isOrphaned ? '__deleted__' : (insp.locationId || '__unassigned__');
        if (isOrphaned) {
          const s = getStats(locId);
          s.total += 1;
          s.pending += 1;
        }
        if (insp.status === 'pass' || insp.status === 'fail') {
          const stats = getStats(locId);
          if (insp.status === 'pass') {
            stats.passed += 1;
            stats.pending = Math.max(0, stats.pending - 1);
          } else {
            stats.failed += 1;
            stats.pending = Math.max(0, stats.pending - 1);
          }
        }
      }
    } else {
      for (const insp of inspections) {
        const locId = insp.locationId || '__unassigned__';
        const stats = getStats(locId);
        stats.total += 1;
        if (insp.status === 'pass') stats.passed += 1;
        else if (insp.status === 'fail') stats.failed += 1;
        else stats.pending += 1;
      }
    }
  } else {
    const nameToId = new Map<string, string>();
    for (const loc of locations) {
      nameToId.set(loc.name, loc.id!);
    }

    if (!isArchived) {
      const trackedExtIdsLegacy = new Set<string>();
      for (const ext of extinguishers) {
        const locId = nameToId.get(ext.section ?? '') ?? '__unassigned__';
        const stats = getStats(locId);
        stats.total += 1;
        stats.pending += 1;
        trackedExtIdsLegacy.add(ext.id!);
      }
      for (const insp of dedupeInspectionsByExtinguisherLatest(inspections)) {
        const isOrphanedLegacy = !trackedExtIdsLegacy.has(insp.extinguisherId);
        const locId = isOrphanedLegacy ? '__deleted__' : (nameToId.get(insp.section) ?? '__unassigned__');
        if (isOrphanedLegacy) {
          const s = getStats(locId);
          s.total += 1;
          s.pending += 1;
        }
        if (insp.status === 'pass' || insp.status === 'fail') {
          const stats = getStats(locId);
          if (insp.status === 'pass') {
            stats.passed += 1;
            stats.pending = Math.max(0, stats.pending - 1);
          } else {
            stats.failed += 1;
            stats.pending = Math.max(0, stats.pending - 1);
          }
        }
      }
    } else {
      for (const insp of inspections) {
        const locId = nameToId.get(insp.section) ?? '__unassigned__';
        const stats = getStats(locId);
        stats.total += 1;
        if (insp.status === 'pass') stats.passed += 1;
        else if (insp.status === 'fail') stats.failed += 1;
        else stats.pending += 1;
      }
    }
  }

  for (const stats of map.values()) {
    stats.percentage =
      stats.total > 0 ? Math.round(((stats.passed + stats.failed) / stats.total) * 100) : 0;
  }

  return map;
}

function sumAllBucketStats(map: Map<string, BucketStats>): BucketStats {
  const agg: BucketStats = { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 };
  for (const stats of map.values()) {
    agg.total += stats.total;
    agg.passed += stats.passed;
    agg.failed += stats.failed;
    agg.pending += stats.pending;
  }
  agg.percentage = agg.total > 0 ? Math.round(((agg.passed + agg.failed) / agg.total) * 100) : 0;
  return agg;
}

export const recalculateWorkspaceInspectionStats = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const data = request.data as { orgId?: string; workspaceId?: string };
  const { orgId, workspaceId } = data;
  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!workspaceId || typeof workspaceId !== 'string') throwInvalidArgument('workspaceId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const wsRef = adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) throwNotFound('Workspace not found.');

  const wsData = wsSnap.data()!;
  const isArchived = wsData.status === 'archived';
  if (isArchived) {
    throwFailedPrecondition('Recalculation is only supported for active workspaces.');
  }

  const [extSnap, locSnap, inspSnap] = await Promise.all([
    adminDb.collection(`org/${orgId}/extinguishers`).where('deletedAt', '==', null).get(),
    adminDb.collection(`org/${orgId}/locations`).get(),
    adminDb.collection(`org/${orgId}/inspections`).where('workspaceId', '==', workspaceId).get(),
  ]);

  const extinguishers: LooseExtinguisher[] = extSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  })) as LooseExtinguisher[];

  const locations: LooseLocation[] = locSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  })) as LooseLocation[];

  const inspections: LooseInspection[] = inspSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  })) as LooseInspection[];

  const hasLocationIdData = detectHasLocationIdData(inspections, extinguishers);
  const map = buildLocationStatsMap({
    inspections,
    extinguishers,
    locations,
    isArchived: false,
    hasLocationIdData,
  });
  const agg = sumAllBucketStats(map);

  await wsRef.update({
    'stats.total': agg.total,
    'stats.passed': agg.passed,
    'stats.failed': agg.failed,
    'stats.pending': agg.pending,
    'stats.lastUpdated': FieldValue.serverTimestamp(),
  });

  return {
    workspaceId,
    stats: {
      total: agg.total,
      passed: agg.passed,
      failed: agg.failed,
      pending: agg.pending,
      percentage: agg.percentage,
    },
  };
});
