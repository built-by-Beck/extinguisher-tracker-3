import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase.ts', () => ({
  db: {},
  auth: {},
  functions: {},
  storage: {},
  geminiModel: {},
}));

import type { Location } from '../services/locationService.ts';
import { planFloorLocationCleanup } from './planFloorLocationCleanup.ts';

function loc(
  id: string,
  name: string,
  parentLocationId: string | null = 'b1',
): Location {
  return {
    id,
    name,
    locationType: 'floor',
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

describe('planFloorLocationCleanup', () => {
  it('plans renames and merges for duplicate floor variants', () => {
    const plan = planFloorLocationCleanup([
      loc('f1', '2nd fl'),
      loc('f2', '2nd Floor'),
      loc('f3', '1st floor'),
    ]);
    expect(plan.renames.some((r) => r.locationId === 'f1')).toBe(true);
    expect(plan.renames.find((r) => r.locationId === 'f1')?.toName).toBe(
      '2nd Floor',
    );
    expect(plan.merges).toHaveLength(1);
    expect(plan.merges[0].keepName).toBe('2nd Floor');
    expect(plan.merges[0].sourceLocationIds).toContain('f1');
  });
});
