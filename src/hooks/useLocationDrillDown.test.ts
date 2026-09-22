import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase.ts', () => ({
  db: {},
  auth: {},
  functions: {},
  storage: {},
  geminiModel: {},
}));

import { useLocationDrillDown } from './useLocationDrillDown.ts';
import type { Location } from '../services/locationService.ts';

function loc(
  id: string,
  name: string,
  locationType: string,
  parentLocationId: string | null = null,
): Location {
  return {
    id,
    name,
    locationType,
    parentLocationId,
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 0,
    deletedAt: null,
    createdAt: null,
    updatedAt: null,
    createdBy: '',
  };
}

describe('useLocationDrillDown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const locations: Location[] = [
    loc('bld-a', 'Building A', 'building'),
    loc('floor-2', '2nd Floor', 'floor', 'bld-a'),
    loc('floor-2-alt', '2nd fl', 'floor', 'bld-a'),
    loc('bld-b', 'Building B', 'building'),
  ];

  it('shows only buildings at root and omits floor cards', () => {
    const { result } = renderHook(() => useLocationDrillDown(locations));
    expect(result.current.isRoot).toBe(true);
    expect(result.current.currentChildren.map((c) => c.id)).toEqual([
      'bld-a',
      'bld-b',
    ]);
  });

  it('treats a building with floor children as a leaf extinguisher scope', () => {
    const { result } = renderHook(() => useLocationDrillDown(locations));

    act(() => {
      result.current.navigateTo('bld-a');
    });

    expect(result.current.isLeaf).toBe(true);
    expect(result.current.currentChildren).toEqual([]);
    expect(result.current.currentLocationAndDescendants.has('floor-2')).toBe(
      true,
    );
    expect(
      result.current.currentLocationAndDescendants.has('floor-2-alt'),
    ).toBe(true);
  });
});
