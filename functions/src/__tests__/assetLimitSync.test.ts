import { describe, it, expect } from '@jest/globals';
import {
  computeAssetLimitFlags,
  countsTowardAssetLimit,
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
