import { describe, it, expect } from 'vitest';
import {
  ASSET_STARTERS,
  getStarterById,
  getStarterByType,
  starterToInspectionItems,
} from './customAssetStarters.ts';

describe('customAssetStarters', () => {
  it('includes elevator starter with fire recall and communications phone', () => {
    const elevator = getStarterById('elevator');
    expect(elevator?.assetType).toBe('Elevator');
    expect(elevator?.defaultItems).toEqual([
      'Fire recall system',
      'Elevator communications phone',
    ]);
  });

  it('includes blank starter with no default items', () => {
    const blank = getStarterById('blank');
    expect(blank?.label).toBe('Custom / Blank');
    expect(starterToInspectionItems(blank!)).toHaveLength(0);
  });

  it('looks up starter by assetType case-insensitively', () => {
    expect(getStarterByType('elevator')?.id).toBe('elevator');
    expect(getStarterByType('EXIT SIGN')?.id).toBe('exit-sign');
    expect(getStarterByType('custom')).toBeUndefined();
  });

  it('converts starter default items to inspection items with order', () => {
    const starter = getStarterById('fire-door')!;
    const items = starterToInspectionItems(starter);
    expect(items).toHaveLength(starter.defaultItems.length);
    expect(items[0].label).toBe(starter.defaultItems[0]);
    expect(items[0].order).toBe(0);
    expect(items.every((item) => item.active)).toBe(true);
  });

  it('ships all planned starter categories', () => {
    const ids = ASSET_STARTERS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'elevator',
        'egress-lighting',
        'exit-sign',
        'egress-path',
        'fire-door',
        'sprinkler',
        'blank',
      ]),
    );
  });
});
