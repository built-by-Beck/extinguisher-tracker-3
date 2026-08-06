import { describe, it, expect } from 'vitest';
import {
  parseCsvText,
  resolveLocationIds,
  csvRowToCreateInput,
} from './customAssetCsv.ts';
import type { Location } from '../services/locationService.ts';

const MOCK_LOCATIONS: Location[] = [
  {
    id: 'loc-1',
    name: 'Building A',
    parentLocationId: null,
    locationType: 'building',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 0,
    createdAt: null,
    updatedAt: null,
    createdBy: 'user-1',
    deletedAt: null,
  },
  {
    id: 'loc-2',
    name: 'Floor 1',
    parentLocationId: 'loc-1',
    locationType: 'floor',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 1,
    createdAt: null,
    updatedAt: null,
    createdBy: 'user-1',
    deletedAt: null,
  },
  {
    id: 'loc-deleted',
    name: 'Deleted Location',
    parentLocationId: null,
    locationType: 'room',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 9,
    createdAt: null,
    updatedAt: null,
    createdBy: 'user-1',
    deletedAt: '2024-01-01',
  },
];

describe('parseCsvText', () => {
  it('parses a minimal valid CSV', () => {
    const csv = `name\nElevator A`;
    const result = parseCsvText(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Elevator A');
    expect(result.rows[0].recurrence).toBe('monthly');
    expect(result.rows[0].items).toHaveLength(0);
  });

  it('parses all columns', () => {
    const csv = [
      'name,assetType,locationName,recurrence,items,assetCode',
      'Elevator 1,Elevator,Building A,monthly,Fire recall system|Elevator communications phone,EL-01',
    ].join('\n');
    const result = parseCsvText(csv);
    expect(result.errors).toHaveLength(0);
    const row = result.rows[0];
    expect(row.name).toBe('Elevator 1');
    expect(row.assetType).toBe('Elevator');
    expect(row.locationName).toBe('Building A');
    expect(row.recurrence).toBe('monthly');
    expect(row.items).toEqual([
      'Fire recall system',
      'Elevator communications phone',
    ]);
    expect(row.assetCode).toBe('EL-01');
  });

  it('returns an error for missing name column', () => {
    const csv = `assetType\nElevator`;
    const result = parseCsvText(csv);
    expect(result.errors.some((e) => e.includes('"name"'))).toBe(true);
    expect(result.rows).toHaveLength(0);
  });

  it('skips rows with empty name and records an error', () => {
    const csv = `name,assetType\n,Elevator\nElevator A,Elevator`;
    const result = parseCsvText(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('"name" is required');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Elevator A');
  });

  it('returns an error for invalid recurrence', () => {
    const csv = `name,recurrence\nElevator A,biweekly`;
    const result = parseCsvText(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('biweekly');
  });

  it('returns an error for unknown columns', () => {
    const csv = `name,unknownColumn\nElevator A,value`;
    const result = parseCsvText(csv);
    expect(result.errors.some((e) => e.includes('"unknowncolumn"'))).toBe(true);
  });

  it('is case-insensitive for headers', () => {
    const csv = `Name,AssetType,Recurrence\nExit Sign,Exit Sign,monthly`;
    const result = parseCsvText(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].assetType).toBe('Exit Sign');
  });

  it('handles quoted fields with commas', () => {
    const csv = `name,assetType\n"Elevator, North Wing",Elevator`;
    const result = parseCsvText(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].name).toBe('Elevator, North Wing');
  });

  it('skips blank lines', () => {
    const csv = `name\nElevator A\n\nElevator B`;
    const result = parseCsvText(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
  });

  it('returns error for empty CSV', () => {
    const result = parseCsvText('   ');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('empty');
  });

  it('splits pipe-separated items correctly', () => {
    const csv = `name,items\nFire Door,Item A|Item B| Item C `;
    const result = parseCsvText(csv);
    expect(result.rows[0].items).toEqual(['Item A', 'Item B', 'Item C']);
  });

  it('handles multiple valid recurrences', () => {
    const recurrences = ['monthly', 'weekly', 'quarterly', 'annual', 'custom'];
    for (const rec of recurrences) {
      const csv = `name,recurrence\nTest Asset,${rec}`;
      const result = parseCsvText(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].recurrence).toBe(rec);
    }
  });
});

describe('resolveLocationIds', () => {
  it('resolves a matching location by name (case-insensitive)', () => {
    const csv = `name,locationName\nElevator,building a`;
    const { rows } = parseCsvText(csv);
    const resolved = resolveLocationIds(rows, MOCK_LOCATIONS);
    expect(resolved[0].locationId).toBe('loc-1');
  });

  it('returns null for an unmatched location name', () => {
    const csv = `name,locationName\nElevator,Nonexistent`;
    const { rows } = parseCsvText(csv);
    const resolved = resolveLocationIds(rows, MOCK_LOCATIONS);
    expect(resolved[0].locationId).toBeNull();
  });

  it('returns null for empty locationName', () => {
    const csv = `name\nElevator`;
    const { rows } = parseCsvText(csv);
    const resolved = resolveLocationIds(rows, MOCK_LOCATIONS);
    expect(resolved[0].locationId).toBeNull();
  });

  it('does not match deleted locations', () => {
    const csv = `name,locationName\nElevator,Deleted Location`;
    const { rows } = parseCsvText(csv);
    const resolved = resolveLocationIds(rows, MOCK_LOCATIONS);
    expect(resolved[0].locationId).toBeNull();
  });
});

describe('csvRowToCreateInput', () => {
  it('converts a resolved row to CreateAssetInput with inspection items', () => {
    const row = {
      name: 'Elevator 1',
      assetType: 'Elevator',
      locationName: 'Building A',
      recurrence: 'monthly' as const,
      items: ['Fire recall system', 'Elevator communications phone'],
      assetCode: 'EL-01',
      locationId: 'loc-1',
    };
    const input = csvRowToCreateInput(row);
    expect(input.name).toBe('Elevator 1');
    expect(input.assetType).toBe('Elevator');
    expect(input.assetCode).toBe('EL-01');
    expect(input.locationId).toBe('loc-1');
    expect(input.recurrence).toBe('monthly');
    expect(input.inspectionItems).toHaveLength(2);
    expect(input.inspectionItems[0].label).toBe('Fire recall system');
    expect(input.inspectionItems[0].order).toBe(0);
    expect(input.inspectionItems[0].active).toBe(true);
    expect(input.inspectionItems[1].label).toBe(
      'Elevator communications phone',
    );
    expect(input.inspectionItems[1].order).toBe(1);
  });

  it('produces empty inspectionItems for a row with no items', () => {
    const row = {
      name: 'Exit Sign 1',
      assetType: '',
      locationName: '',
      recurrence: 'monthly' as const,
      items: [],
      assetCode: '',
      locationId: null,
    };
    const input = csvRowToCreateInput(row);
    expect(input.inspectionItems).toHaveLength(0);
    expect(input.assetType).toBeUndefined();
    expect(input.assetCode).toBeUndefined();
    expect(input.locationId).toBeNull();
  });
});
