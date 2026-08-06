import { describe, it, expect } from 'vitest';
import {
  generateAssetsFromLocations,
  getBuildingsWithStairwells,
} from './generateAssetsFromLocations.ts';
import type { AssetStarter } from './customAssetStarters.ts';
import type { Location } from '../services/locationService.ts';

const ELEVATOR_STARTER: AssetStarter = {
  id: 'elevator',
  assetType: 'Elevator',
  label: 'Elevator',
  description: 'Monthly fire-recall and communications check',
  defaultItems: ['Fire recall system', 'Elevator communications phone'],
};

const BLANK_STARTER: AssetStarter = {
  id: 'blank',
  assetType: '',
  label: 'Custom / Blank',
  description: 'Start with a blank checklist',
  defaultItems: [],
};

function makeLocation(
  overrides: Partial<Location> & { id: string; name: string },
): Location {
  return {
    parentLocationId: null,
    locationType: 'room',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 0,
    createdAt: null,
    updatedAt: null,
    createdBy: 'test',
    deletedAt: null,
    ...overrides,
  };
}

const BUILDING = makeLocation({
  id: 'bldg-1',
  name: 'Building A',
  locationType: 'building',
});
const STAIRWELL_1 = makeLocation({
  id: 'sw-1',
  name: 'Stairwell 1',
  locationType: 'stairwell',
  parentLocationId: 'bldg-1',
});
const STAIRWELL_2 = makeLocation({
  id: 'sw-2',
  name: 'Stairwell 2',
  locationType: 'stairwell',
  parentLocationId: 'bldg-1',
});
const FLOOR_1 = makeLocation({
  id: 'fl-1',
  name: 'Floor 1',
  locationType: 'floor',
  parentLocationId: 'sw-1',
});
const FLOOR_2 = makeLocation({
  id: 'fl-2',
  name: 'Floor 2',
  locationType: 'floor',
  parentLocationId: 'sw-1',
});

const LOCATIONS_WITH_FLOORS = [
  BUILDING,
  STAIRWELL_1,
  STAIRWELL_2,
  FLOOR_1,
  FLOOR_2,
];
const LOCATIONS_NO_FLOORS = [BUILDING, STAIRWELL_1, STAIRWELL_2];

describe('generateAssetsFromLocations', () => {
  it('generates one asset per floor under each stairwell', () => {
    const result = generateAssetsFromLocations({
      locations: LOCATIONS_WITH_FLOORS,
      rootLocationId: 'bldg-1',
      starter: ELEVATOR_STARTER,
    });
    // Stairwell 1 has Floor 1 + Floor 2; Stairwell 2 has no floors → 1 asset
    expect(result.inputs).toHaveLength(3);
    expect(result.skippedDuplicates).toHaveLength(0);
  });

  it('generates one asset per stairwell when no floors exist', () => {
    const result = generateAssetsFromLocations({
      locations: LOCATIONS_NO_FLOORS,
      rootLocationId: 'bldg-1',
      starter: ELEVATOR_STARTER,
    });
    expect(result.inputs).toHaveLength(2);
    const names = result.inputs.map((i) => i.name);
    expect(names).toContain('Stairwell 1 — Elevator');
    expect(names).toContain('Stairwell 2 — Elevator');
  });

  it('asset names omit type suffix for blank starter', () => {
    const result = generateAssetsFromLocations({
      locations: LOCATIONS_NO_FLOORS,
      rootLocationId: 'bldg-1',
      starter: BLANK_STARTER,
    });
    const names = result.inputs.map((i) => i.name);
    expect(names).toContain('Stairwell 1');
    expect(names).toContain('Stairwell 2');
  });

  it('attaches the correct locationId to each generated input', () => {
    const result = generateAssetsFromLocations({
      locations: LOCATIONS_WITH_FLOORS,
      rootLocationId: 'bldg-1',
      starter: ELEVATOR_STARTER,
    });
    // Floor-level assets should get floor locationId
    const floor1Asset = result.inputs.find((i) => i.name.includes('Floor 1'));
    expect(floor1Asset?.locationId).toBe('fl-1');
    // Stairwell 2 has no floors → stairwell locationId
    const sw2Asset = result.inputs.find((i) => i.name.includes('Stairwell 2'));
    expect(sw2Asset?.locationId).toBe('sw-2');
  });

  it('generates inspection items from the starter', () => {
    const result = generateAssetsFromLocations({
      locations: LOCATIONS_NO_FLOORS,
      rootLocationId: 'bldg-1',
      starter: ELEVATOR_STARTER,
    });
    expect(result.inputs[0].inspectionItems).toHaveLength(2);
    expect(result.inputs[0].inspectionItems[0].label).toBe(
      'Fire recall system',
    );
    expect(result.inputs[0].inspectionItems[0].active).toBe(true);
  });

  it('skips duplicates when existingAssets is provided', () => {
    const result = generateAssetsFromLocations({
      locations: LOCATIONS_NO_FLOORS,
      rootLocationId: 'bldg-1',
      starter: ELEVATOR_STARTER,
      existingAssets: [{ name: 'Stairwell 1 — Elevator', locationId: 'sw-1' }],
    });
    expect(result.inputs).toHaveLength(1);
    expect(result.skippedDuplicates).toHaveLength(1);
    expect(result.skippedDuplicates[0]).toBe('Stairwell 1 — Elevator');
  });

  it('uses all org stairwells when no rootLocationId is given', () => {
    const result = generateAssetsFromLocations({
      locations: LOCATIONS_NO_FLOORS,
      starter: ELEVATOR_STARTER,
    });
    expect(result.inputs).toHaveLength(2);
  });

  it('sets recurrence to monthly', () => {
    const result = generateAssetsFromLocations({
      locations: LOCATIONS_NO_FLOORS,
      rootLocationId: 'bldg-1',
      starter: ELEVATOR_STARTER,
    });
    for (const input of result.inputs) {
      expect(input.recurrence).toBe('monthly');
    }
  });

  it('ignores deleted locations', () => {
    const deletedStairwell = {
      ...STAIRWELL_1,
      deletedAt: '2024-01-01',
    };
    const result = generateAssetsFromLocations({
      locations: [BUILDING, deletedStairwell, STAIRWELL_2],
      rootLocationId: 'bldg-1',
      starter: ELEVATOR_STARTER,
    });
    expect(result.inputs).toHaveLength(1);
    expect(result.inputs[0].name).toContain('Stairwell 2');
  });
});

describe('getBuildingsWithStairwells', () => {
  it('returns buildings that have stairwell descendants', () => {
    const buildings = getBuildingsWithStairwells(LOCATIONS_NO_FLOORS);
    expect(buildings).toHaveLength(1);
    expect(buildings[0].id).toBe('bldg-1');
  });

  it('returns empty list when no stairwells exist', () => {
    const locs = [BUILDING, FLOOR_1];
    const buildings = getBuildingsWithStairwells(locs);
    expect(buildings).toHaveLength(0);
  });

  it('excludes deleted buildings', () => {
    const deletedBuilding = { ...BUILDING, deletedAt: '2024-01-01' };
    const buildings = getBuildingsWithStairwells([
      deletedBuilding,
      STAIRWELL_1,
    ]);
    expect(buildings).toHaveLength(0);
  });
});
