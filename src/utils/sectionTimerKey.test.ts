import { describe, expect, it } from 'vitest';
import type { Location } from '../services/locationService.ts';
import { resolveSectionTimerKey } from './sectionTimerKey.ts';

const locations: Location[] = [
  {
    id: 'loc-a',
    name: 'Floor 2 East',
    parentLocationId: null,
    locationType: 'floor',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 0,
    createdAt: null,
    updatedAt: null,
    createdBy: 'u',
    deletedAt: null,
  },
];

describe('resolveSectionTimerKey', () => {
  it('uses location name when locationId matches', () => {
    expect(
      resolveSectionTimerKey({ locationId: 'loc-a', section: 'Legacy' }, locations),
    ).toBe('Floor 2 East');
  });

  it('falls back to ext.section when locationId unknown', () => {
    expect(
      resolveSectionTimerKey({ locationId: 'missing', section: 'Basement' }, locations),
    ).toBe('Basement');
  });

  it('uses inspection locationId when ext has none', () => {
    expect(
      resolveSectionTimerKey(
        { locationId: null, section: '' },
        locations,
        { locationId: 'loc-a', section: '' },
      ),
    ).toBe('Floor 2 East');
  });

  it('returns empty string when nothing to resolve', () => {
    expect(resolveSectionTimerKey({ locationId: null, section: '' }, locations)).toBe('');
  });
});
