import { describe, it, expect } from 'vitest';
import { groupInspectionsByLocationOrFloor } from './locationInspectionGroups.ts';
import type { Location } from '../services/locationService.ts';
import type { Extinguisher } from '../services/extinguisherService.ts';
import type { Inspection } from '../services/inspectionService.ts';

const makeLoc = (
  id: string,
  name: string,
  parentId: string | null,
  type: string,
): Location =>
  ({
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
    createdBy: 't',
    deletedAt: null,
  }) as Location;

describe('groupInspectionsByLocationOrFloor', () => {
  const locations = [
    makeLoc('b1', 'Building A', null, 'building'),
    makeLoc('f4', 'Floor 4', 'b1', 'floor'),
    makeLoc('r1', 'Room 401', 'f4', 'room'),
  ];

  it('groups room inspections under their floor when scoped to building', () => {
    const inspections = [
      { id: 'i1', assetId: 'A-2', extinguisherId: 'e1', locationId: 'r1' },
      { id: 'i2', assetId: 'A-1', extinguisherId: 'e2', locationId: 'f4' },
    ] as Inspection[];
    const groups = groupInspectionsByLocationOrFloor({
      inspections,
      locations,
      extinguishers: [],
      scopeLocationId: 'b1',
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('f4');
    expect(groups[0].inspections.map((i) => i.assetId)).toEqual(['A-1', 'A-2']);
  });

  it('uses denormalized floor when unit is on the building', () => {
    const extinguishers = [{ id: 'e3', floor: 'Floor 2' } as Extinguisher];
    const inspections = [
      {
        id: 'i3',
        assetId: 'B-1',
        extinguisherId: 'e3',
        locationId: 'b1',
      },
    ] as Inspection[];
    const groups = groupInspectionsByLocationOrFloor({
      inspections,
      locations,
      extinguishers,
      scopeLocationId: 'b1',
    });
    expect(groups[0].key).toBe('floor-label:floor 2');
    expect(groups[0].label).toBe('Floor 2');
  });
});
