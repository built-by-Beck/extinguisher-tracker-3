/**
 * Monthly workspace list snapshot.
 *
 * Source-of-truth contract:
 * - Monthly checklist lists/counts are real `org/{orgId}/inspections` rows for one workspace,
 *   de-duped by target identity so a saved duplicate cannot inflate checked counts.
 * - Inventory counts remain inventory-domain counts.
 * - Replacement-history counts remain lifecycle-domain counts and are not monthly checked work
 *   unless an actual inspection row has `status === 'replaced'`.
 */

import type { Extinguisher } from '../services/extinguisherService.ts';
import type { Inspection } from '../services/inspectionService.ts';
import type { Location } from '../services/locationService.ts';
import {
  buildLocationStatsMap,
  collectInspectionRowsForScope,
  detectHasLocationIdData,
  type WorkspaceInspectionBucketStats,
} from './workspaceInspectionStats.ts';

export const EMPTY_MONTHLY_WORKSPACE_STATS: WorkspaceInspectionBucketStats = {
  total: 0,
  passed: 0,
  failed: 0,
  pending: 0,
  replaced: 0,
  percentage: 0,
};

export interface MonthlyWorkspaceInspectionSnapshot {
  rows: Inspection[];
  stats: WorkspaceInspectionBucketStats;
  locationStatsMap: Map<string, WorkspaceInspectionBucketStats>;
  hasLocationIdData: boolean;
}

export function countMonthlyInspectionRows(
  rows: Inspection[],
): WorkspaceInspectionBucketStats {
  const stats: WorkspaceInspectionBucketStats = {
    ...EMPTY_MONTHLY_WORKSPACE_STATS,
  };
  for (const row of rows) {
    stats.total += 1;
    if (row.status === 'pass') stats.passed += 1;
    else if (row.status === 'fail') stats.failed += 1;
    else if (row.status === 'replaced') stats.replaced += 1;
    else stats.pending += 1;
  }
  stats.percentage =
    stats.total > 0
      ? Math.round(((stats.passed + stats.failed) / stats.total) * 100)
      : 0;
  return stats;
}

export function getMonthlyCheckedCount(
  stats: WorkspaceInspectionBucketStats,
): number {
  return stats.passed + stats.failed;
}

export function buildMonthlyWorkspaceInspectionSnapshot(params: {
  workspaceId: string | null | undefined;
  inspections: Inspection[];
  extinguishers: Extinguisher[];
  locations: Location[];
  isArchived?: boolean;
}): MonthlyWorkspaceInspectionSnapshot {
  const {
    workspaceId,
    inspections,
    extinguishers,
    locations,
    isArchived = false,
  } = params;
  if (!workspaceId) {
    return {
      rows: [],
      stats: { ...EMPTY_MONTHLY_WORKSPACE_STATS },
      locationStatsMap: new Map(),
      hasLocationIdData: false,
    };
  }

  const workspaceRows = inspections.filter(
    (row) => !row.workspaceId || row.workspaceId === workspaceId,
  );
  const hasLocationIdData = detectHasLocationIdData(
    workspaceRows,
    extinguishers,
  );
  const rows = collectInspectionRowsForScope({
    extinguishers,
    inspections: workspaceRows,
    workspaceId,
    isArchived,
    hasLocationIdData,
    locations,
    anchorLocationId: null,
  });

  return {
    rows,
    stats: countMonthlyInspectionRows(rows),
    locationStatsMap: buildLocationStatsMap({
      inspections: workspaceRows,
      extinguishers,
      locations,
      isArchived,
      hasLocationIdData,
    }),
    hasLocationIdData,
  };
}
