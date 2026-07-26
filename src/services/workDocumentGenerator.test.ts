import { describe, expect, it } from 'vitest';
import type { Location } from './locationService.ts';
import {
  findBestLocationMatch,
  generateEgressStairwellSheet,
  parseWorkDocumentIntent,
} from './workDocumentGenerator.ts';

const locations: Location[] = [
  {
    id: 'b1',
    name: 'Building B',
    parentLocationId: null,
    locationType: 'building',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 1,
    createdAt: null,
    updatedAt: null,
    createdBy: 'u1',
    deletedAt: null,
  },
  {
    id: 'sw1',
    name: 'Stairwell North',
    parentLocationId: 'b1',
    locationType: 'stairwell',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 1,
    createdAt: null,
    updatedAt: null,
    createdBy: 'u1',
    deletedAt: null,
  },
  {
    id: 'f1',
    name: 'Floor 1',
    parentLocationId: 'sw1',
    locationType: 'floor',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 1,
    createdAt: null,
    updatedAt: null,
    createdBy: 'u1',
    deletedAt: null,
  },
  {
    id: 'f2',
    name: 'Floor 2',
    parentLocationId: 'sw1',
    locationType: 'floor',
    section: null,
    description: null,
    address: null,
    gps: null,
    sortOrder: 2,
    createdAt: null,
    updatedAt: null,
    createdBy: 'u1',
    deletedAt: null,
  },
];

describe('parseWorkDocumentIntent', () => {
  it('detects egress stairwell checksheet requests', () => {
    const intent = parseWorkDocumentIntent(
      'Create a checksheet for stairwell egress lights in Building B',
    );
    expect(intent).not.toBeNull();
    expect(intent?.kind).toBe('egress_stairwell');
    expect(intent?.buildingHint).toMatch(/building b/i);
  });

  it('ignores unrelated prompts', () => {
    expect(parseWorkDocumentIntent('Show overdue inspections')).toBeNull();
  });
});

describe('generateEgressStairwellSheet', () => {
  it('matches building and builds floor rows per stairwell', () => {
    const building = findBestLocationMatch(locations, 'Building B');
    expect(building?.id).toBe('b1');

    const draft = generateEgressStairwellSheet({
      locations,
      buildingHint: 'Building B',
    });

    expect(draft.relatedLocationId).toBe('b1');
    expect(draft.schema.sections).toHaveLength(1);
    expect(draft.schema.sections[0]?.items).toHaveLength(2);
    expect(
      draft.schema.sections[0]?.items[0]?.fields.some(
        (field) => field.type === 'pass_fail',
      ),
    ).toBe(true);
  });
});
