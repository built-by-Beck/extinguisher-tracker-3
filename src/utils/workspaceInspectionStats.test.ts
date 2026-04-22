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
} from './workspaceInspectionStats.ts';

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
} as Extinguisher;

const ext2: Extinguisher = {
  id: 'ext2',
  assetId: 'FE-002',
  serial: 'S2',
  section: '',
  locationId: 'floor1',
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

  it('keeps "not yet inspected" aligned with scoped rows when some extinguishers have no inspection doc', () => {
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
      // ext2 has no inspection doc yet and should count as pending via dummy row
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
    expect(agg.total).toBe(2);
    expect(agg.passed).toBe(1);
    expect(agg.failed).toBe(0);
    expect(agg.pending).toBe(1);

    const rows = collectInspectionRowsForScope({
      extinguishers,
      inspections,
      workspaceId: 'ws1',
      isArchived: false,
      hasLocationIdData,
      locations: [locFloor],
      anchorLocationId: null,
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === 'pending')).toHaveLength(1);
    expect(rows.filter((r) => r.status === 'pass')).toHaveLength(1);
  });
});
