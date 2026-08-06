import { describe, it, expect } from 'vitest';
import { collectDistinctAssetTypes } from './customAssetTypes.ts';

describe('collectDistinctAssetTypes', () => {
  it('returns sorted distinct types for active assets only', () => {
    const types = collectDistinctAssetTypes([
      { assetType: 'Elevator', active: true, status: 'active' },
      { assetType: 'Exit Sign', active: true, status: 'active' },
      { assetType: 'Elevator', active: true, status: 'active' },
      { assetType: 'Fire Door', active: false, status: 'active' },
      { assetType: 'Sprinkler', active: true, status: 'retired' },
    ]);
    expect(types).toEqual(['Elevator', 'Exit Sign']);
  });

  it('ignores blank asset types', () => {
    const types = collectDistinctAssetTypes([
      { assetType: '  ', active: true, status: 'active' },
      { assetType: undefined, active: true, status: 'active' },
    ]);
    expect(types).toEqual([]);
  });
});
