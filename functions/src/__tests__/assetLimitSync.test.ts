import { describe, it, expect } from '@jest/globals';
import {
  computeAssetLimitFlags,
  countsTowardAssetLimit,
  overLimitMessage,
} from '../billing/assetLimitSync.js';

describe('computeAssetLimitFlags', () => {
  it('treats a missing limit as unlimited', () => {
    expect(computeAssetLimitFlags(9999, null)).toEqual({
      assetLimitReached: false,
      overLimit: false,
    });
    expect(computeAssetLimitFlags(9999, undefined)).toEqual({
      assetLimitReached: false,
      overLimit: false,
    });
  });

  it('is clear while under the limit', () => {
    expect(computeAssetLimitFlags(49, 50)).toEqual({
      assetLimitReached: false,
      overLimit: false,
    });
  });

  it('blocks new creates at exactly the limit without flagging overLimit', () => {
    expect(computeAssetLimitFlags(50, 50)).toEqual({
      assetLimitReached: true,
      overLimit: false,
    });
  });

  it('flags overLimit above the limit (e.g. after a downgrade)', () => {
    expect(computeAssetLimitFlags(251, 50)).toEqual({
      assetLimitReached: true,
      overLimit: true,
    });
  });
});

describe('countsTowardAssetLimit', () => {
  it('counts only non-deleted, lifecycle-active docs', () => {
    expect(
      countsTowardAssetLimit({ deletedAt: null, lifecycleStatus: 'active' }),
    ).toBe(true);
    expect(
      countsTowardAssetLimit({
        deletedAt: new Date(),
        lifecycleStatus: 'deleted',
      }),
    ).toBe(false);
    expect(
      countsTowardAssetLimit({ deletedAt: null, lifecycleStatus: 'retired' }),
    ).toBe(false);
    expect(countsTowardAssetLimit(undefined)).toBe(false);
  });
});

describe('overLimitMessage', () => {
  it('states the count, the limit, and how many units to archive', () => {
    const msg = overLimitMessage(548, 50);
    expect(msg).toContain('548 active extinguishers');
    expect(msg).toContain('limit of 50');
    expect(msg).toContain('archive 498 or more units');
  });

  it('tells the user inspections and exports are unaffected', () => {
    expect(overLimitMessage(51, 50)).toContain(
      'Inspections and data exports still work.',
    );
  });
});
