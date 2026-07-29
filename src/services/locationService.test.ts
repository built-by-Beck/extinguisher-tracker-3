import { describe, it, expect } from 'vitest';
import {
  normalizeLocationName,
  buildLocationTree,
  getAllDescendantIds,
  getAncestorChain,
  getLocationPath,
  findAncestorOfType,
  getDirectChildren,
  getChildrenOfType,
  getBuildingLevelLocations,
  deriveLocationFields,
  deepestLocationId,
  collectLocationScopeIds,
  buildFloorSeedNames,
  missingFloorNamesUnderParent,
  type Location,
} from './locationService.ts';

const makeLoc = (
  id: string,
  name: string,
  parentId: string | null = null,
  type = 'building',
): Location => ({
  id,
  name,
  parentLocationId: parentId,
  locationType: type,
  section: null,
  description: null,
  address: null,
  gps: null,
  sortOrder: 0,
  createdAt: null,
  updatedAt: null,
  createdBy: 'test',
  deletedAt: null,
});

describe('normalizeLocationName', () => {
  it('trims whitespace', () => {
    expect(normalizeLocationName('  Building A  ')).toBe('building a');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeLocationName('Building   A')).toBe('building a');
  });

  it('lowercases', () => {
    expect(normalizeLocationName('1st Floor')).toBe('1st floor');
  });

  it('treats "1st floor" and "1st  Floor" as equal after normalization', () => {
    expect(normalizeLocationName('1st floor')).toBe(
      normalizeLocationName('1st  Floor'),
    );
  });
});

describe('buildLocationTree', () => {
  it('returns roots for locations without parents', () => {
    const locs = [makeLoc('1', 'Campus A'), makeLoc('2', 'Campus B')];
    const tree = buildLocationTree(locs);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(0);
  });

  it('nests children under parents', () => {
    const locs = [
      makeLoc('1', 'Campus A'),
      makeLoc('2', 'Building 1', '1'),
      makeLoc('3', 'Floor 1', '2'),
    ];
    const tree = buildLocationTree(locs);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe('Floor 1');
  });

  it('treats orphan children as roots', () => {
    const locs = [makeLoc('2', 'Building 1', 'nonexistent')];
    const tree = buildLocationTree(locs);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Building 1');
  });

  it('handles empty input', () => {
    expect(buildLocationTree([])).toHaveLength(0);
  });
});

describe('getAllDescendantIds', () => {
  const locs = [
    makeLoc('1', 'Campus'),
    makeLoc('2', 'Building A', '1'),
    makeLoc('3', 'Floor 1', '2'),
    makeLoc('4', 'Floor 2', '2'),
    makeLoc('5', 'Room 101', '3'),
    makeLoc('6', 'Building B', '1'),
  ];

  it('returns all descendants of a parent', () => {
    const desc = getAllDescendantIds(locs, '1');
    expect(desc).toEqual(new Set(['2', '3', '4', '5', '6']));
  });

  it('returns direct children only for leaf-adjacent', () => {
    const desc = getAllDescendantIds(locs, '2');
    expect(desc).toEqual(new Set(['3', '4', '5']));
  });

  it('returns empty set for a leaf', () => {
    const desc = getAllDescendantIds(locs, '5');
    expect(desc.size).toBe(0);
  });

  it('returns empty set for nonexistent id', () => {
    const desc = getAllDescendantIds(locs, 'nonexistent');
    expect(desc.size).toBe(0);
  });
});

describe('getAncestorChain', () => {
  const locs = [
    makeLoc('1', 'Campus'),
    makeLoc('2', 'Building A', '1'),
    makeLoc('3', 'Floor 1', '2'),
  ];

  it('returns ancestors from root to parent', () => {
    const chain = getAncestorChain(locs, '3');
    expect(chain.map((l) => l.name)).toEqual(['Campus', 'Building A']);
  });

  it('returns empty for root node', () => {
    const chain = getAncestorChain(locs, '1');
    expect(chain).toHaveLength(0);
  });

  it('returns empty for nonexistent id', () => {
    const chain = getAncestorChain(locs, 'nope');
    expect(chain).toHaveLength(0);
  });
});

describe('getLocationPath', () => {
  const locs = [
    makeLoc('1', 'Campus A'),
    makeLoc('2', 'Building 2', '1'),
    makeLoc('3', 'Floor 3', '2'),
  ];

  it('returns full path with separator', () => {
    expect(getLocationPath(locs, '3')).toBe('Campus A > Building 2 > Floor 3');
  });

  it('returns just the name for root', () => {
    expect(getLocationPath(locs, '1')).toBe('Campus A');
  });

  it('returns empty string for nonexistent id', () => {
    expect(getLocationPath(locs, 'nope')).toBe('');
  });
});

describe('deriveLocationFields', () => {
  const locs = [
    makeLoc('c1', 'Campus', null, 'campus'),
    makeLoc('b1', 'Building A', 'c1', 'building'),
    makeLoc('f4', 'Floor 4', 'b1', 'floor'),
    makeLoc('r1', 'Room 401', 'f4', 'room'),
  ];

  it('derives building parentLocation and floor from a room', () => {
    const d = deriveLocationFields(locs, 'r1', 'east wall');
    expect(d.locationId).toBe('r1');
    expect(d.parentLocation).toBe('Building A');
    expect(d.floor).toBe('Floor 4');
    expect(d.section).toBe('Room 401');
    expect(d.vicinity).toBe('east wall');
    expect(d.buildingId).toBe('b1');
    expect(d.floorId).toBe('f4');
    expect(d.subLocationId).toBe('r1');
    expect(d.locationPath).toBe('Campus > Building A > Floor 4 > Room 401');
  });

  it('uses floor node when selected without sub-location', () => {
    const d = deriveLocationFields(locs, 'f4');
    expect(d.parentLocation).toBe('Building A');
    expect(d.floor).toBe('Floor 4');
    expect(d.subLocationId).toBeNull();
    expect(d.section).toBe('');
  });

  it('deepestLocationId prefers sub-location', () => {
    expect(deepestLocationId('b1', 'f4', 'r1')).toBe('r1');
    expect(deepestLocationId('b1', 'f4', null)).toBe('f4');
    expect(deepestLocationId('b1', null, null)).toBe('b1');
  });
});

describe('location picker helpers', () => {
  const locs = [
    makeLoc('b1', 'Building A', null, 'building'),
    makeLoc('f1', 'Floor 1', 'b1', 'floor'),
    makeLoc('f2', 'Floor 2', 'b1', 'floor'),
    makeLoc('r1', 'Lobby', 'f1', 'lobby'),
  ];

  it('findAncestorOfType walks to building', () => {
    expect(findAncestorOfType(locs, 'r1', 'building')?.id).toBe('b1');
    expect(findAncestorOfType(locs, 'r1', 'floor')?.id).toBe('f1');
  });

  it('getDirectChildren / getChildrenOfType', () => {
    expect(getDirectChildren(locs, 'b1').map((l) => l.id)).toEqual([
      'f1',
      'f2',
    ]);
    expect(getChildrenOfType(locs, 'f1', 'lobby').map((l) => l.id)).toEqual([
      'r1',
    ]);
  });

  it('getBuildingLevelLocations returns buildings', () => {
    expect(getBuildingLevelLocations(locs).map((l) => l.id)).toEqual(['b1']);
  });

  it('collectLocationScopeIds includes descendants', () => {
    expect(collectLocationScopeIds(locs, ['b1'])).toEqual(
      new Set(['b1', 'f1', 'f2', 'r1']),
    );
    expect(collectLocationScopeIds(locs, ['f1'])).toEqual(
      new Set(['f1', 'r1']),
    );
  });

  it('buildFloorSeedNames and missingFloorNamesUnderParent', () => {
    const desired = buildFloorSeedNames({
      floorCount: 2,
      includeGround: true,
      includeBasement: true,
    });
    expect(desired).toEqual(['Basement', 'Ground Floor', 'Floor 1', 'Floor 2']);
    const missing = missingFloorNamesUnderParent(locs, 'b1', desired);
    expect(missing).toEqual(['Basement', 'Ground Floor']);
  });
});
