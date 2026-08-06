import { describe, it, expect } from 'vitest';
import {
  filterExtinguishersForPrint,
  toDetailedPrintRow,
} from './inventoryPrint.ts';
import type { Extinguisher } from '../services/extinguisherService.ts';
import type { Location } from '../services/locationService.ts';
import { collectLocationScopeIds } from '../services/locationService.ts';

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

describe('filterExtinguishersForPrint', () => {
  const locations = [
    makeLoc('b1', 'Building A', null, 'building'),
    makeLoc('f1', 'Floor 1', 'b1', 'floor'),
    makeLoc('b2', 'Building D', null, 'building'),
  ];
  const items = [
    {
      id: '1',
      assetId: 'A-1',
      serial: 'S1',
      locationId: 'f1',
      category: 'standard',
      deletedAt: null,
      lifecycleStatus: 'active',
    },
    {
      id: '2',
      assetId: 'D-1',
      serial: 'S2',
      locationId: 'b2',
      category: 'standard',
      deletedAt: null,
      lifecycleStatus: 'active',
    },
  ] as unknown as Extinguisher[];

  it('filters to selected building descendants', () => {
    const scope = collectLocationScopeIds(locations, ['b1']);
    const filtered = filterExtinguishersForPrint({
      items,
      mode: 'all',
      locationScopeIds: scope,
      currentYear: 2026,
    });
    expect(filtered.map((e) => e.assetId)).toEqual(['A-1']);
  });

  it('includes multiple buildings', () => {
    const scope = collectLocationScopeIds(locations, ['b1', 'b2']);
    const filtered = filterExtinguishersForPrint({
      items,
      mode: 'all',
      locationScopeIds: scope,
      currentYear: 2026,
    });
    expect(filtered.map((e) => e.assetId).sort()).toEqual(['A-1', 'D-1']);
  });
});

describe('toDetailedPrintRow', () => {
  it('uses hierarchy path when locationId is set', () => {
    const locations = [
      makeLoc('b1', 'Building A', null, 'building'),
      makeLoc('f4', 'Floor 4', 'b1', 'floor'),
    ];
    const row = toDetailedPrintRow(
      {
        assetId: 'X-1',
        serial: 'SER',
        barcode: 'BC',
        extinguisherType: 'ABC',
        extinguisherSize: '10 lb',
        manufacturer: 'Amerex',
        locationId: 'f4',
        floor: 'Floor 4',
        vicinity: 'east wall',
        category: 'standard',
        complianceStatus: null,
        manufactureYear: 2020,
        expirationYear: 2032,
        lastMonthlyInspection: null,
      } as unknown as Extinguisher,
      locations,
      2026,
    );
    expect(row.location).toBe('Building A > Floor 4');
    expect(row.floor).toBe('Floor 4');
    expect(row.vicinity).toBe('east wall');
    expect(row.barcode).toBe('BC');
  });
});
