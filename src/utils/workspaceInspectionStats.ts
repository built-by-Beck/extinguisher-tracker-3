/**
 * Single source of truth for workspace inspection counts and scoped row lists.
 * Matches WorkspaceDetail / Dashboard expectations (extinguishers + inspections).
 *
 * Author: built_by_Beck
 */

import type { Extinguisher } from '../services/extinguisherService.ts';
import type { Inspection } from '../services/inspectionService.ts';
import type { Location } from '../services/locationService.ts';
import { getAllDescendantIds } from '../services/locationService.ts';

/** Most recent activity timestamp on an inspection (for de-dupe by extinguisher). */
function inspectionActivityMs(insp: Inspection): number {
  for (const v of [insp.updatedAt, insp.inspectedAt, insp.createdAt]) {
    const ms = firestoreLikeToMillis(v);
    if (ms > 0) return ms;
  }
  return 0;
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

/**
 * One row per extinguisher: the chronologically latest inspection wins (handles duplicate docs / re-saves).
 */
export function dedupeInspectionsByExtinguisherLatest(inspections: Inspection[]): Inspection[] {
  const sorted = [...inspections].sort((a, b) => inspectionActivityMs(b) - inspectionActivityMs(a));
  const seen = new Set<string>();
  const out: Inspection[] = [];
  for (const insp of sorted) {
    if (seen.has(insp.extinguisherId)) continue;
    seen.add(insp.extinguisherId);
    out.push(insp);
  }
  return out;
}

export interface WorkspaceInspectionBucketStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  replaced: number;
  percentage: number;
}

function isReplacedExtinguisher(ext: Extinguisher): boolean {
  return ext.lifecycleStatus === 'replaced' || ext.category === 'replaced';
}

export function detectHasLocationIdData(
  inspections: Inspection[],
  extinguishers: Extinguisher[],
): boolean {
  return inspections.some((insp) => insp.locationId) || extinguishers.some((ext) => ext.locationId);
}

export function buildLocationStatsMap(params: {
  inspections: Inspection[];
  extinguishers: Extinguisher[];
  locations: Location[];
  isArchived: boolean;
  hasLocationIdData: boolean;
}): Map<string, WorkspaceInspectionBucketStats> {
  const { inspections, extinguishers, locations, isArchived, hasLocationIdData } = params;
  const map = new Map<string, WorkspaceInspectionBucketStats>();

  function getStats(id: string): WorkspaceInspectionBucketStats {
    if (!map.has(id)) {
      map.set(id, { total: 0, passed: 0, failed: 0, pending: 0, replaced: 0, percentage: 0 });
    }
    return map.get(id)!;
  }

  if (hasLocationIdData) {
    if (!isArchived) {
      const trackedExtIds = new Set<string>();
      for (const ext of extinguishers) {
        const locId = ext.locationId || '__unassigned__';
        if (isReplacedExtinguisher(ext)) {
          getStats(locId).replaced += 1;
          continue;
        }
        const stats = getStats(locId);
        stats.total += 1;
        stats.pending += 1;
        trackedExtIds.add(ext.id!);
      }
      // De-dupe by extinguisher so duplicate pass/fail docs (re-saves, sync, imports) do not
      // each subtract from pending — that was collapsing "left to check" toward zero.
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
        else if (insp.status === 'replaced') stats.replaced += 1;
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
        const locId = nameToId.get(ext.section) ?? '__unassigned__';
        if (isReplacedExtinguisher(ext)) {
          getStats(locId).replaced += 1;
          continue;
        }
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
        else if (insp.status === 'replaced') stats.replaced += 1;
        else stats.pending += 1;
      }
    }
  }

  for (const stats of map.values()) {
    stats.percentage =
      stats.total > 0 ? Math.round(((stats.passed + stats.failed + stats.replaced) / stats.total) * 100) : 0;
  }

  return map;
}

export function sumAllBucketStats(map: Map<string, WorkspaceInspectionBucketStats>): WorkspaceInspectionBucketStats {
  const agg: WorkspaceInspectionBucketStats = { total: 0, passed: 0, failed: 0, pending: 0, replaced: 0, percentage: 0 };
  for (const stats of map.values()) {
    agg.total += stats.total;
    agg.passed += stats.passed;
    agg.failed += stats.failed;
    agg.pending += stats.pending;
    agg.replaced += stats.replaced;
  }
  agg.percentage = agg.total > 0 ? Math.round(((agg.passed + agg.failed + agg.replaced) / agg.total) * 100) : 0;
  return agg;
}

export function aggregateStatsForLocationSubtree(
  map: Map<string, WorkspaceInspectionBucketStats>,
  locations: Location[],
  locationId: string,
): WorkspaceInspectionBucketStats {
  const descendants = getAllDescendantIds(locations, locationId);
  const allIds = [locationId, ...descendants];
  const agg: WorkspaceInspectionBucketStats = { total: 0, passed: 0, failed: 0, pending: 0, replaced: 0, percentage: 0 };
  for (const id of allIds) {
    const stats = map.get(id);
    if (stats) {
      agg.total += stats.total;
      agg.passed += stats.passed;
      agg.failed += stats.failed;
      agg.pending += stats.pending;
      agg.replaced += stats.replaced;
    }
  }
  agg.percentage = agg.total > 0 ? Math.round(((agg.passed + agg.failed + agg.replaced) / agg.total) * 100) : 0;
  return agg;
}

function dummyInspection(ext: Extinguisher, workspaceId: string): Inspection {
  return {
    id: `dummy-${ext.id}`,
    extinguisherId: ext.id!,
    workspaceId,
    assetId: ext.assetId,
    status: 'pending',
    inspectedAt: null,
    inspectedBy: null,
    section: ext.section || '',
    locationId: ext.locationId || null,
    qrCodeValue: ext.qrCodeValue,
    barcode: ext.barcode,
    serial: ext.serial,
  } as unknown as Inspection;
}

function inspectionBelongsToWorkspace(insp: Inspection, workspaceId: string): boolean {
  return !insp.workspaceId || insp.workspaceId === workspaceId;
}

/**
 * Rows for a workspace scope: whole org view (anchor null) or one location subtree.
 * Active workspaces: one row per extinguisher (latest inspection doc wins).
 */
export function collectInspectionRowsForScope(params: {
  extinguishers: Extinguisher[];
  inspections: Inspection[];
  workspaceId: string;
  isArchived: boolean;
  hasLocationIdData: boolean;
  locations: Location[];
  /** null = entire workspace (all buckets); else this location + descendants */
  anchorLocationId: string | null;
}): Inspection[] {
  const {
    extinguishers,
    inspections,
    workspaceId,
    isArchived,
    hasLocationIdData,
    locations,
    anchorLocationId,
  } = params;

  const combined: Inspection[] = [];
  const handledExtIds = new Set<string>();
  const trackableExtinguishers = extinguishers.filter((e) => !isReplacedExtinguisher(e));
  const trackedExtIds = new Set(trackableExtinguishers.map((e) => e.id!));

  if (isArchived) {
    let relevant: Set<string> | null = null;
    if (anchorLocationId) {
      relevant = getAllDescendantIds(locations, anchorLocationId);
      relevant.add(anchorLocationId);
    }
    for (const insp of inspections) {
      let locId: string;
      if (hasLocationIdData) {
        locId = insp.locationId || '__unassigned__';
      } else {
        const nameToId = new Map(locations.map((l) => [l.name, l.id!] as const));
        locId = nameToId.get(insp.section) ?? '__unassigned__';
      }
      if (relevant && !relevant.has(locId)) continue;
      combined.push(insp);
    }
    return combined;
  }

  const inWs = (insp: Inspection) => inspectionBelongsToWorkspace(insp, workspaceId);

  if (hasLocationIdData) {
    if (anchorLocationId === null) {
      const deduped = dedupeInspectionsByExtinguisherLatest(inspections.filter(inWs));
      for (const insp of deduped) {
        const isOrphaned = !trackedExtIds.has(insp.extinguisherId);
        combined.push(insp);
        if (!isOrphaned) handledExtIds.add(insp.extinguisherId);
      }
      for (const ext of trackableExtinguishers) {
        if (!handledExtIds.has(ext.id!)) {
          combined.push(dummyInspection(ext, workspaceId));
        }
      }
    } else {
      const relevantLocIds = getAllDescendantIds(locations, anchorLocationId);
      relevantLocIds.add(anchorLocationId);
      const extMap = new Map<string, Extinguisher>();
      for (const ext of trackableExtinguishers) {
        const extLocId = ext.locationId || '__unassigned__';
        if (relevantLocIds.has(extLocId)) {
          extMap.set(ext.id!, ext);
        }
      }
      const filtered = inspections.filter((insp) => {
        if (!inWs(insp)) return false;
        if (!trackedExtIds.has(insp.extinguisherId)) return false;
        const inspLocId = insp.locationId || '__unassigned__';
        return relevantLocIds.has(inspLocId);
      });
      const deduped = dedupeInspectionsByExtinguisherLatest(filtered);
      for (const insp of deduped) {
        combined.push(insp);
        handledExtIds.add(insp.extinguisherId);
      }
      for (const ext of extMap.values()) {
        if (!handledExtIds.has(ext.id!)) {
          combined.push(dummyInspection(ext, workspaceId));
        }
      }
    }
  } else {
    const nameToId = new Map<string, string>();
    for (const loc of locations) {
      nameToId.set(loc.name, loc.id!);
    }
    const trackedLegacy = new Set(trackableExtinguishers.map((e) => e.id!));

    let relevantLocIds: Set<string>;
    if (anchorLocationId !== null) {
      relevantLocIds = getAllDescendantIds(locations, anchorLocationId);
      relevantLocIds.add(anchorLocationId);
    } else {
      relevantLocIds = new Set(locations.map((l) => l.id!));
      relevantLocIds.add('__unassigned__');
      relevantLocIds.add('__deleted__');
    }

    const extMap = new Map<string, Extinguisher>();
    for (const ext of trackableExtinguishers) {
      const locId = nameToId.get(ext.section) ?? '__unassigned__';
      if (relevantLocIds.has(locId)) {
        extMap.set(ext.id!, ext);
      }
    }

    if (anchorLocationId === null) {
      const deduped = dedupeInspectionsByExtinguisherLatest(inspections.filter(inWs));
      for (const insp of deduped) {
        const isOrphaned = !trackedLegacy.has(insp.extinguisherId);
        combined.push(insp);
        if (!isOrphaned) handledExtIds.add(insp.extinguisherId);
      }
      const dummySource = trackableExtinguishers.filter((e) => trackedLegacy.has(e.id!));
      for (const ext of dummySource) {
        if (!handledExtIds.has(ext.id!)) {
          combined.push(dummyInspection(ext, workspaceId));
        }
      }
    } else {
      const filtered = inspections.filter((insp) => {
        if (!inWs(insp)) return false;
        const isOrphaned = !trackedLegacy.has(insp.extinguisherId);
        if (isOrphaned) return false;
        const inspLocId = nameToId.get(insp.section) ?? '__unassigned__';
        return relevantLocIds.has(inspLocId);
      });
      const deduped = dedupeInspectionsByExtinguisherLatest(filtered);
      for (const insp of deduped) {
        combined.push(insp);
        handledExtIds.add(insp.extinguisherId);
      }
      for (const ext of extMap.values()) {
        if (!handledExtIds.has(ext.id!)) {
          combined.push(dummyInspection(ext, workspaceId));
        }
      }
    }
  }

  return combined;
}

export function filterRowsByStatusList(
  rows: Inspection[],
  filter: 'pending' | 'pass' | 'fail' | 'replaced' | 'checked',
): Inspection[] {
  if (filter === 'checked') {
    return rows.filter((r) => r.status === 'pass' || r.status === 'fail' || r.status === 'replaced');
  }
  return rows.filter((r) => r.status === filter);
}
