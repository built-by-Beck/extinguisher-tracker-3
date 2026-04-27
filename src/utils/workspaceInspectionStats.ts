/**
 * Single source of truth for workspace inspection counts and scoped row lists.
 * Active monthly progress is derived from inspection rows only.
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
    const key = inspectionIdentity(insp);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(insp);
  }
  return out;
}

function inspectionIdentity(insp: Inspection): string {
  if (insp.targetType === 'asset') return `asset:${insp.assetRefId || insp.id || insp.assetId}`;
  return `ext:${insp.extinguisherId || insp.id || insp.assetId}`;
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

/**
 * Extinguisher IDs superseded by another non-deleted record via `replacesExtId`
 * (replacement successor). If the old unit is still `active` in Firestore, it would
 * otherwise duplicate pending inspection work with the successor row.
 */
export function getSupersededExtinguisherIds(extinguishers: Extinguisher[]): Set<string> {
  const superseded = new Set<string>();
  for (const e of extinguishers) {
    if (e.deletedAt != null) continue;
    const rid = e.replacesExtId;
    if (rid && typeof rid === 'string' && rid.length > 0) {
      superseded.add(rid);
    }
  }
  return superseded;
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
  const supersededIds = getSupersededExtinguisherIds(extinguishers);
  const map = new Map<string, WorkspaceInspectionBucketStats>();

  function getStats(id: string): WorkspaceInspectionBucketStats {
    if (!map.has(id)) {
      map.set(id, { total: 0, passed: 0, failed: 0, pending: 0, replaced: 0, percentage: 0 });
    }
    return map.get(id)!;
  }

  if (hasLocationIdData) {
    if (!isArchived) {
      // De-dupe by extinguisher so duplicate pass/fail docs (re-saves, sync, imports) do not
      // each subtract from pending — that was collapsing "left to check" toward zero.
      for (const insp of dedupeInspectionsByExtinguisherLatest(inspections)) {
        if (insp.targetType !== 'asset' && supersededIds.has(insp.extinguisherId)) continue;
        const locId = insp.locationId || '__unassigned__';
        const stats = getStats(locId);
        stats.total += 1;
        if (insp.status === 'pass') stats.passed += 1;
        else if (insp.status === 'fail') stats.failed += 1;
        else if (insp.status === 'replaced') stats.replaced += 1;
        else stats.pending += 1;
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
      for (const insp of dedupeInspectionsByExtinguisherLatest(inspections)) {
        if (insp.targetType !== 'asset' && supersededIds.has(insp.extinguisherId)) continue;
        const locId = nameToId.get(insp.section) ?? '__unassigned__';
        const stats = getStats(locId);
        stats.total += 1;
        if (insp.status === 'pass') stats.passed += 1;
        else if (insp.status === 'fail') stats.failed += 1;
        else if (insp.status === 'replaced') stats.replaced += 1;
        else stats.pending += 1;
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
    // Completion is inspection outcomes only; replaced legacy units are tracked separately.
    stats.percentage =
      stats.total > 0 ? Math.round(((stats.passed + stats.failed) / stats.total) * 100) : 0;
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
  agg.percentage = agg.total > 0 ? Math.round(((agg.passed + agg.failed) / agg.total) * 100) : 0;
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
  agg.percentage = agg.total > 0 ? Math.round(((agg.passed + agg.failed) / agg.total) * 100) : 0;
  return agg;
}

function inspectionBelongsToWorkspace(insp: Inspection, workspaceId: string): boolean {
  return !insp.workspaceId || insp.workspaceId === workspaceId;
}

/**
 * Rows for a workspace scope: whole org view (anchor null) or one location subtree.
 * Active workspaces: one real inspection row per extinguisher/asset (latest legacy duplicate wins).
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
  const supersededIds = getSupersededExtinguisherIds(extinguishers);
  const trackableExtinguishers = extinguishers.filter(
    (e) => !isReplacedExtinguisher(e) && !supersededIds.has(e.id!),
  );
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
        if (insp.targetType !== 'asset' && supersededIds.has(insp.extinguisherId)) continue;
        combined.push(insp);
      }
    } else {
      const relevantLocIds = getAllDescendantIds(locations, anchorLocationId);
      relevantLocIds.add(anchorLocationId);
      const filtered = inspections.filter((insp) => {
        if (!inWs(insp)) return false;
        if (insp.targetType !== 'asset' && !trackedExtIds.has(insp.extinguisherId)) return false;
        const inspLocId = insp.locationId || '__unassigned__';
        return relevantLocIds.has(inspLocId);
      });
      const deduped = dedupeInspectionsByExtinguisherLatest(filtered);
      for (const insp of deduped) {
        if (insp.targetType !== 'asset' && supersededIds.has(insp.extinguisherId)) continue;
        combined.push(insp);
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
        if (insp.targetType !== 'asset' && supersededIds.has(insp.extinguisherId)) continue;
        combined.push(insp);
      }
    } else {
      const filtered = inspections.filter((insp) => {
        if (!inWs(insp)) return false;
        const isOrphaned = insp.targetType !== 'asset' && !trackedLegacy.has(insp.extinguisherId);
        if (isOrphaned) return false;
        const inspLocId = nameToId.get(insp.section) ?? '__unassigned__';
        return relevantLocIds.has(inspLocId);
      });
      const deduped = dedupeInspectionsByExtinguisherLatest(filtered);
      for (const insp of deduped) {
        if (insp.targetType !== 'asset' && supersededIds.has(insp.extinguisherId)) continue;
        combined.push(insp);
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
