/**
 * Starter templates for org-specific field work documents.
 * Pass/fail fields are included for printable sheets; in-app completion is Phase 2.
 *
 * Author: built_by_Beck
 */

import type {
  WorkDocumentField,
  WorkDocumentSchema,
  WorkDocumentSection,
} from '../types/workDocument.ts';

export const EGRESS_STAIRWELL_DEFAULT_FIELDS: WorkDocumentField[] = [
  {
    key: 'egress_light',
    label: 'Egress light operational',
    type: 'pass_fail',
    required: true,
  },
  {
    key: 'exit_sign',
    label: 'Exit sign illuminated',
    type: 'pass_fail',
    required: true,
  },
  {
    key: 'notes',
    label: 'Notes / corrective action',
    type: 'text',
  },
];

export function createBlankChecksheetSchema(): WorkDocumentSchema {
  return {
    sections: [
      {
        id: crypto.randomUUID(),
        title: 'Section 1',
        description: null,
        items: [
          {
            id: crypto.randomUUID(),
            label: 'Item 1',
            fields: [
              {
                key: 'result',
                label: 'Pass / Fail',
                type: 'pass_fail',
              },
            ],
          },
        ],
      },
    ],
    printNotes:
      'Circle P (pass), F (fail), or N/A. Correct deficiencies before leaving the site when possible.',
    footerText: 'Inspector signature: __________________  Date: __________',
  };
}

export function createEgressStairwellSection(
  title: string,
  items: WorkDocumentSection['items'],
  description?: string | null,
): WorkDocumentSection {
  return {
    id: crypto.randomUUID(),
    title,
    description: description ?? null,
    items,
  };
}

export function createEgressFloorItem(
  label: string,
  locationId?: string | null,
  floorNumber?: number | null,
): WorkDocumentSection['items'][number] {
  return {
    id: crypto.randomUUID(),
    label,
    locationId: locationId ?? null,
    locationType: 'floor',
    meta: floorNumber != null ? { floorNumber } : undefined,
    fields: EGRESS_STAIRWELL_DEFAULT_FIELDS.map((field) => ({ ...field })),
  };
}
