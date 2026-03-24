import { describe, it, expect } from 'vitest';
import {
  createEmptyFilters,
  hasActiveFilters,
  countActiveFilters,
} from './FilterPanel.tsx';

describe('createEmptyFilters', () => {
  it('returns all empty sets', () => {
    const f = createEmptyFilters();
    expect(f.statuses.size).toBe(0);
    expect(f.categories.size).toBe(0);
    expect(f.compliance.size).toBe(0);
    expect(f.locationIds.size).toBe(0);
  });
});

describe('hasActiveFilters', () => {
  it('returns false for empty filters', () => {
    expect(hasActiveFilters(createEmptyFilters())).toBe(false);
  });

  it('returns true when statuses has entries', () => {
    const f = createEmptyFilters();
    f.statuses.add('pass');
    expect(hasActiveFilters(f)).toBe(true);
  });

  it('returns true when categories has entries', () => {
    const f = createEmptyFilters();
    f.categories.add('standard');
    expect(hasActiveFilters(f)).toBe(true);
  });

  it('returns true when locationIds has entries', () => {
    const f = createEmptyFilters();
    f.locationIds.add('loc1');
    expect(hasActiveFilters(f)).toBe(true);
  });
});

describe('countActiveFilters', () => {
  it('returns 0 for empty filters', () => {
    expect(countActiveFilters(createEmptyFilters())).toBe(0);
  });

  it('counts across all filter types', () => {
    const f = createEmptyFilters();
    f.statuses.add('pass');
    f.statuses.add('fail');
    f.categories.add('standard');
    f.locationIds.add('loc1');
    expect(countActiveFilters(f)).toBe(4);
  });
});
