import { describe, expect, it } from 'vitest';
import {
  floorSortRank,
  normalizeFloorLabel,
  normalizeLocationLabelKey,
  sortFloorsNaturally,
} from './floorParsing.ts';

describe('normalizeFloorLabel', () => {
  it('canonicalizes common 2nd-floor variants', () => {
    expect(normalizeFloorLabel(' 2ND fl. ')).toBe('2nd Floor');
    expect(normalizeFloorLabel('Second Floor')).toBe('2nd Floor');
    expect(normalizeFloorLabel('floor 2')).toBe('2nd Floor');
    expect(normalizeFloorLabel('2nd  floor')).toBe('2nd Floor');
    expect(normalizeFloorLabel('2nd Floor ')).toBe('2nd Floor');
  });

  it('canonicalizes basement / ground / specials', () => {
    expect(normalizeFloorLabel('bsmt')).toBe('Basement');
    expect(normalizeFloorLabel('Basement Level')).toBe('Basement');
    expect(normalizeFloorLabel('ground fl')).toBe('Ground Floor');
    expect(normalizeFloorLabel('PH')).toBe('Penthouse');
    expect(normalizeFloorLabel('roof level')).toBe('Roof');
  });

  it('returns null for non-floor text', () => {
    expect(normalizeFloorLabel('near elevator')).toBeNull();
    expect(normalizeFloorLabel('')).toBeNull();
  });
});

describe('normalizeLocationLabelKey', () => {
  it('collapses case and spacing', () => {
    expect(normalizeLocationLabelKey('  1st   Floor ')).toBe('1st floor');
  });
});

describe('sortFloorsNaturally', () => {
  it('orders basement before numbered floors before roof', () => {
    expect(
      sortFloorsNaturally([
        'Roof',
        '2nd Floor',
        'Basement',
        'Ground Floor',
        '1st Floor',
      ]),
    ).toEqual([
      'Basement',
      'Ground Floor',
      '1st Floor',
      '2nd Floor',
      'Roof',
    ]);
  });

  it('ranks via floorSortRank consistently', () => {
    expect(floorSortRank('Basement')).toBeLessThan(floorSortRank('1st Floor'));
    expect(floorSortRank('1st Floor')).toBeLessThan(floorSortRank('Penthouse'));
  });
});
