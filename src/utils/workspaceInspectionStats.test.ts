/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { Extinguisher } from '../services/extinguisherService.ts';
import type { Inspection } from '../services/inspectionService.ts';
import type { Location } from '../services/locationService.ts';
import {
  dedupeInspectionsByExtinguisherLatest,
  collectInspectionRowsForScope,
  buildLocationStatsMap,
  sumAllBucketStats,
  detectHasLocationIdData,
  filterRowsByStatusList,
} from './workspaceInspectionStats.ts';
import {
  buildMonthlyWorkspaceInspectionSnapshot,
  countMonthlyInspectionRows,
  getMonthlyCheckedCount,
} from './monthlyWorkspaceInspectionSnapshot.ts';

const locFloor: Location = {
  id: 'floor1',
  name: 'Floor 1',
  parentLocationId: null,
  locationType: 'floor',
  section: null,
  description: null,
  address: null,
  gps: null,
  sortOrder: 0,
  createdAt: null,
  updatedAt: null,
  createdBy: 'u',
  deletedAt: null,
};

const ext1: Extinguisher = {
  id: 'ext1',
  assetId: 'FE-001',
  serial: 'S1',
  section: '',
  locationId: 'floor1',
  category: 'standard',
  lifecycleStatus: 'active',
  deletedAt: null,
} as Extinguisher;

const ext2: Extinguisher = {
  id: 'ext2',
  assetId: 'FE-002',
  serial: 'S2',
  section: '',
  locationId: 'floor1',
  category: 'standard',
  lifecycleStatus: 'active',
  deletedAt: null,
} as Extinguisher;

function insp(partial: Partial<Inspection> & Pick<Inspection, 'id' | 'extinguisherId' | 'status'>): Inspection {
  return {
    workspaceId: 'ws1',
    assetId: 'FE-001',
    section: '',
    locationId: 'floor1',
    serial: 'S1',
    ...partial,
  } as Inspection;
}

describe('dedupeInspectionsByExtinguisherLatest', () => {
  it('keeps a single row per extinguisher (latest activity wins)', () => {
    const rows = dedupeInspectionsByExtinguisherLatest([
      insp({ id: 'a', extinguisherId: 'ext1', status: 'pass', updatedAt: { seconds: 100, nanoseconds: 0 } as unknown }),
      insp({ id: 'b', extinguisherId: 'ext1', status: 'fail', updatedAt: { seconds: 200, nanoseconds: 0 } as unknown }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('b');
    expect(rows[0]!.status).toBe('fail');
  });

  it('keeps custom asset rows separate from extinguisher rows and each other', () => {
    const rows = dedupeInspectionsByExtinguisherLatest([
      insp({ id: 'ext-row', extinguisherId: 'ext1', status: 'pending' }),
      {
        id: 'asset-a',
        targetType: 'asset',
        assetRefId: 'asset-a',
        extinguisherId: '',
        workspaceId: 'ws1',
        assetId: 'A',
        section: 'Floor 1',
        locationId: 'floor1',
        status: 'pending',
      } as Inspection,
      {
        id: 'asset-b',
        targetType: 'asset',
        assetRefId: 'asset-b',
        extinguisherId: '',
        workspaceId: 'ws1',
        assetId: 'B',
        section: 'Floor 1',
        locationId: 'floor1',
        status: 'pending',
      } as Inspection,
    ]);
    expect(rows.map((row) => row.id).sort()).toEqual(['asset-a', 'asset-b', 'ext-row']);
  });
});

describe('collectInspectionRowsForScope (active, deduped)', () => {
  it('returns one row per extinguisher when duplicate inspection docs exist', () => {
    const inspections: Inspection[] = [
      insp({ id: 'old', extinguisherId: 'ext1', status: 'pass', updatedAt: { seconds: 1, nanoseconds: 0 } as unknown }),
      insp({ id: 'new', extinguisherId: 'ext1', status: 'pass', updatedAt: { seconds: 99, nanoseconds: 0 } as unknown }),
    ];
    const rows = collectInspectionRowsForScope({
      extinguishers: [ext1],
      inspections,
      workspaceId: 'ws1',
      isArchived: false,
      hasLocationIdData: true,
      locations: [locFloor],
      anchorLocationId: 'floor1',
    });
    expect(rows.filter((r) => r.extinguisherId === 'ext1')).toHaveLength(1);
    expect(rows[0]!.status).toBe('pass');
  });
});

describe('buildLocationStatsMap vs collectInspectionRowsForScope', () => {
  it('keeps pending, passed, and failed in mutually exclusive buckets from inspection rows', () => {
    const inspections: Inspection[] = [
      insp({ id: 'pending', extinguisherId: 'ext1', status: 'pending', assetId: 'FE-001' }),
      insp({ id: 'failed', extinguisherId: 'ext2', status: 'fail', assetId: 'FE-002' }),
    ];
    const hasLocationIdData = detectHasLocationIdData(inspections, [ext1, ext2]);
    const map = buildLocationStatsMap({
      inspections,
      extinguishers: [ext1, ext2],
      locations: [locFloor],
      isArchived: false,
      hasLocationIdData,
    });
    const agg = sumAllBucketStats(map);
    expect(agg.total).toBe(2);
    expect(agg.pending).toBe(1);
    expect(agg.passed).toBe(0);
    expect(agg.failed).toBe(1);

    const rows = collectInspectionRowsForScope({
      extinguishers: [ext1, ext2],
      inspections,
      workspaceId: 'ws1',
      isArchived: false,
      hasLocationIdData,
      locations: [locFloor],
      anchorLocationId: null,
    });
    expect(rows.filter((r) => r.status === 'pending').map((r) => r.id)).toEqual(['pending']);
    expect(rows.filter((r) => r.status === 'fail').map((r) => r.id)).toEqual(['failed']);
  });

  it('pending/row counts stay consistent with duplicate pass docs for one extinguisher', () => {
    const inspections: Inspection[] = [
      insp({ id: 'x1', extinguisherId: 'ext1', status: 'pass', updatedAt: { seconds: 10, nanoseconds: 0 } as unknown }),
      insp({ id: 'x2', extinguisherId: 'ext1', status: 'pass', updatedAt: { seconds: 20, nanoseconds: 0 } as unknown }),
    ];
    const hasLocationIdData = detectHasLocationIdData(inspections, [ext1]);
    expect(hasLocationIdData).toBe(true);
    const map = buildLocationStatsMap({
      inspections,
      extinguishers: [ext1],
      locations: [locFloor],
      isArchived: false,
      hasLocationIdData,
    });
    const agg = sumAllBucketStats(map);
    expect(agg.total).toBe(1);
    expect(agg.pending).toBe(0);
    expect(agg.passed).toBe(1);
    expect(agg.failed).toBe(0);
    expect(agg.replaced).toBe(0);

    const scopeRows = collectInspectionRowsForScope({
      extinguishers: [ext1],
      inspections,
      workspaceId: 'ws1',
      isArchived: false,
      hasLocationIdData,
      locations: [locFloor],
      anchorLocationId: 'floor1',
    });
    expect(scopeRows).toHaveLength(1);
    expect(scopeRows[0]!.status).toBe('pass');
  });

  it('does not count blank next-inspection inventory as pending until repair creates a row', () => {
    const inspections: Inspection[] = [
      insp({
        id: 'done-old',
        extinguisherId: 'ext1',
        status: 'pass',
        updatedAt: { seconds: 10, nanoseconds: 0 } as unknown,
      }),
      insp({
        id: 'done-new',
        extinguisherId: 'ext1',
        status: 'pass',
        updatedAt: { seconds: 20, nanoseconds: 0 } as unknown,
      }),
      // ext2 has no inspection doc and blank Next Inspection; it is not a real monthly checklist row.
    ];
    const extinguishers = [ext1, ext2];
    const hasLocationIdData = detectHasLocationIdData(inspections, extinguishers);
    const map = buildLocationStatsMap({
      inspections,
      extinguishers,
      locations: [locFloor],
      isArchived: false,
      hasLocationIdData,
    });
    const agg = sumAllBucketStats(map);
    expect(agg.total).toBe(1);
    expect(agg.passed).toBe(1);
    expect(agg.failed).toBe(0);
    expect(agg.pending).toBe(0);
    expect(agg.replaced).toBe(0);

    const rows = collectInspectionRowsForScope({
      extinguishers,
      inspections,
      workspaceId: 'ws1',
      isArchived: false,
      hasLocationIdData,
      locations: [locFloor],
      anchorLocationId: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows.filter((r) => r.status === 'pending')).toHaveLength(0);
    expect(rows.filter((r) => r.status === 'pass')).toHaveLength(1);
  });
});

describe('monthly workspace source-of-truth snapshot', () => {
  it('derives monthly counts from one deduped inspection-row list for the workspace', () => {
    const inspections: Inspection[] = [
      insp({ id: 'old-pass', extinguisherId: 'ext1', status: 'pass', updatedAt: { seconds: 10, nanoseconds: 0 } as unknown }),
      insp({ id: 'latest-fail', extinguisherId: 'ext1', status: 'fail', updatedAt: { seconds: 20, nanoseconds: 0 } as unknown }),
      insp({ id: 'pending', extinguisherId: 'ext2', status: 'pending', assetId: 'FE-002' }),
      insp({ id: 'other-workspace', workspaceId: 'ws2', extinguisherId: 'ext2', status: 'pass', assetId: 'FE-002' }),
    ];

    const snapshot = buildMonthlyWorkspaceInspectionSnapshot({
      workspaceId: 'ws1',
      inspections,
      extinguishers: [ext1, ext2],
      locations: [locFloor],
    });

    expect(snapshot.rows.map((row) => row.id).sort()).toEqual(['latest-fail', 'pending']);
    expect(snapshot.stats).toMatchObject({
      total: 2,
      passed: 0,
      failed: 1,
      pending: 1,
      replaced: 0,
      percentage: 50,
    });
    expect(countMonthlyInspectionRows(snapshot.rows)).toEqual(snapshot.stats);
  });

  it('keeps replacement history out of checked totals unless an inspection row is replaced', () => {
    const replacementHistoryOnly = buildMonthlyWorkspaceInspectionSnapshot({
      workspaceId: 'ws1',
      inspections: [
        insp({ id: 'passed', extinguisherId: 'ext1', status: 'pass' }),
        insp({ id: 'pending', extinguisherId: 'ext2', status: 'pending', assetId: 'FE-002' }),
      ],
      extinguishers: [
        ext1,
        {
          ...ext2,
          replacementHistory: [
            {
              replacedExtId: 'old-ext2',
              replacedAssetId: 'FE-OLD',
              replacedAt: { seconds: 30, nanoseconds: 0 },
              replacedBy: 'u',
              replacedByEmail: 'u@example.com',
              reason: 'Damaged',
            },
          ],
        } as Extinguisher,
      ],
      locations: [locFloor],
    });

    expect(replacementHistoryOnly.stats.replaced).toBe(0);
    expect(getMonthlyCheckedCount(replacementHistoryOnly.stats)).toBe(1);

    const monthlyReplacedRow = buildMonthlyWorkspaceInspectionSnapshot({
      workspaceId: 'ws1',
      inspections: [
        insp({ id: 'passed', extinguisherId: 'ext1', status: 'pass' }),
        insp({ id: 'replaced-row', extinguisherId: 'ext2', status: 'replaced', assetId: 'FE-002' }),
      ],
      extinguishers: [ext1, ext2],
      locations: [locFloor],
    });

    expect(monthlyReplacedRow.stats.replaced).toBe(1);
    expect(getMonthlyCheckedCount(monthlyReplacedRow.stats)).toBe(1);
  });
});

describe('monthly status filters', () => {
  it('treats checked as pass/fail only, with replaced as a separate monthly status', () => {
    const rows = [
      insp({ id: 'pass', extinguisherId: 'ext1', status: 'pass' }),
      insp({ id: 'fail', extinguisherId: 'ext2', status: 'fail', assetId: 'FE-002' }),
      insp({ id: 'replaced', extinguisherId: 'ext3', status: 'replaced', assetId: 'FE-003' }),
      insp({ id: 'pending', extinguisherId: 'ext4', status: 'pending', assetId: 'FE-004' }),
    ];

    expect(filterRowsByStatusList(rows, 'checked').map((row) => row.id)).toEqual(['pass', 'fail']);
    expect(filterRowsByStatusList(rows, 'replaced').map((row) => row.id)).toEqual(['replaced']);
  });
});

describe('replaced lifecycle extinguishers', () => {
  const extOld: Extinguisher = {
    id: 'old1',
    assetId: 'FE-OLD',
    serial: 'SO',
    section: '',
    locationId: 'floor1',
    lifecycleStatus: 'replaced',
    category: 'standard',
    replacedByExtId: 'new1',
  } as Extinguisher;

  const extNew: Extinguisher = {
    id: 'new1',
    assetId: 'FE-OLD',
    serial: 'SN',
    section: '',
    locationId: 'floor1',
    lifecycleStatus: 'active',
    category: 'standard',
    replacesExtId: 'old1',
  } as Extinguisher;

  it('excludes replaced extinguishers from active scoped inspection rows', () => {
    const rows = collectInspectionRowsForScope({
      extinguishers: [extOld, extNew],
      inspections: [],
      workspaceId: 'ws1',
      isArchived: false,
      hasLocationIdData: true,
      locations: [locFloor],
      anchorLocationId: 'floor1',
    });
    expect(rows).toHaveLength(0);
  });

  it('does not let live replaced units inflate active monthly stats', () => {
    const map = buildLocationStatsMap({
      inspections: [],
      extinguishers: [extOld, extNew],
      locations: [locFloor],
      isArchived: false,
      hasLocationIdData: true,
    });
    const floor = map.get('floor1');
    expect(floor).toBeUndefined();
  });
});

describe('superseded active-old chain (successor has replacesExtId)', () => {
  const extOldStale: Extinguisher = {
    id: 'oldStale',
    assetId: 'FE-STALE',
    serial: 'S-OLD',
    section: '',
    locationId: 'floor1',
    lifecycleStatus: 'active',
    category: 'standard',
    deletedAt: null,
  } as Extinguisher;

  const extSuccessor: Extinguisher = {
    id: 'newSucc',
    assetId: 'FE-STALE',
    serial: 'S-NEW',
    section: '',
    locationId: 'floor1',
    lifecycleStatus: 'active',
    category: 'standard',
    replacesExtId: 'oldStale',
    deletedAt: null,
  } as Extinguisher;

  it('excludes superseded old unit from pending totals (only successor counts)', () => {
    const inspections: Inspection[] = [];
    const extinguishers = [extOldStale, extSuccessor];
    const hasLocationIdData = detectHasLocationIdData(inspections, extinguishers);
    const map = buildLocationStatsMap({
      inspections,
      extinguishers,
      locations: [locFloor],
      isArchived: false,
      hasLocationIdData,
    });
    const floor = map.get('floor1');
    expect(floor).toBeUndefined();
  });

  it('does not emit scoped rows from live inventory for superseded chains', () => {
    const rows = collectInspectionRowsForScope({
      extinguishers: [extOldStale, extSuccessor],
      inspections: [],
      workspaceId: 'ws1',
      isArchived: false,
      hasLocationIdData: true,
      locations: [locFloor],
      anchorLocationId: 'floor1',
    });
    expect(rows).toHaveLength(0);
  });
});
