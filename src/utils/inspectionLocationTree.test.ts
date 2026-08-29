import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase.ts', () => ({
  db: {},
  auth: {},
  functions: {},
  storage: {},
  geminiModel: {},
}));

import type { Location } from '../services/locationService.ts';
import {
  attachScopeCounts,
  buildInspectionLocationTree,
  findInspectionLocationNode,
  resolveSelectionLocationIds,
} from './inspectionLocationTree.ts';

function loc(
  id: string,
  name: string,
  locationType: string,
  parentLocationId: string | null = null,
): Location {
  return {
    id,
    name,
    locationType,
    parentLocationId,
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 0,
    deletedAt: null,
    createdAt: null,
    updatedAt: null,
    createdBy: '',
  };
}

describe('buildInspectionLocationTree', () => {
  const locations: Location[] = [
    loc('b1', 'Building A', 'building'),
    loc('f1', '2nd fl', 'floor', 'b1'),
    loc('f2', '2nd Floor', 'floor', 'b1'),
    loc('f3', '1st Floor', 'floor', 'b1'),
    loc('r1', 'Room 201', 'room', 'f1'),
    loc('r2', 'Room 202', 'room', 'f2'),
    loc('b2', 'Building B', 'building'),
  ];

  it('merges duplicate floor labels under a building', () => {
    const tree = buildInspectionLocationTree(locations);
    expect(tree).toHaveLength(2);
    const buildingA = tree.find((b) => b.key === 'b1')!;
    expect(buildingA.children.map((c) => c.name)).toEqual([
      '1st Floor',
      '2nd Floor',
    ]);
    const second = buildingA.children.find((c) => c.name === '2nd Floor')!;
    expect(second.locationIds.sort()).toEqual(['f1', 'f2']);
  });

  it('resolves building selection to all descendant location ids', () => {
    const tree = buildInspectionLocationTree(locations);
    const ids = resolveSelectionLocationIds(tree, locations, 'b1');
    expect(ids?.sort()).toEqual(['b1', 'f1', 'f2', 'f3', 'r1', 'r2'].sort());
  });

  it('resolves merged floor selection and counts through descendant rooms', () => {
    const tree = buildInspectionLocationTree(locations);
    const second = findInspectionLocationNode(
      tree,
      tree[0].children.find((c) => c.name === '2nd Floor')!.key,
    );
    expect(second?.kind).toBe('floor');
    const ids = resolveSelectionLocationIds(tree, locations, second!.key);
    expect(ids?.sort()).toEqual(['f1', 'f2', 'r1', 'r2'].sort());

    const counted = attachScopeCounts(
      tree,
      new Map([
        ['f1', 2],
        ['f2', 3],
        ['f3', 1],
        ['r1', 4],
        ['r2', 5],
      ]),
      locations,
    );
    const b = counted.find((n) => n.key === 'b1')!;
    expect(b.children.find((c) => c.name === '2nd Floor')!.count).toBe(14);
  });
});
