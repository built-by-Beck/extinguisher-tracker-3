/**
 * Built-in starter catalog for Custom Assets.
 *
 * Starters provide sensible default inspection columns for common asset types.
 * These are operational guidance checklists — NOT certified NFPA compliance
 * checklists and should NOT be presented as such to users.
 */

import { createInspectionItem } from '../services/assetService.ts';
import type { CustomAssetInspectionItem } from '../services/assetService.ts';

export interface AssetStarter {
  /** Stable identifier — never change once shipped */
  id: string;
  /** Canonical assetType string pre-filled in the create form */
  assetType: string;
  /** Human-readable display label */
  label: string;
  /** Short description shown in the picker */
  description: string;
  /** Default inspection column labels */
  defaultItems: string[];
}

export const ASSET_STARTERS: AssetStarter[] = [
  {
    id: 'elevator',
    assetType: 'Elevator',
    label: 'Elevator',
    description: 'Monthly fire-recall and communications check',
    defaultItems: ['Fire recall system', 'Elevator communications phone'],
  },
  {
    id: 'egress-lighting',
    assetType: 'Egress Lighting',
    label: 'Egress Lighting',
    description: 'Emergency / exit-path lighting unit',
    defaultItems: [
      'Lamp illuminates on activation',
      'Battery holds charge (self-test)',
      'Lens / housing undamaged',
      'Fixture securely mounted',
    ],
  },
  {
    id: 'exit-sign',
    assetType: 'Exit Sign',
    label: 'Exit Sign',
    description: 'Illuminated exit sign',
    defaultItems: [
      'Sign illuminated (primary power)',
      'Battery backup functional',
      'Lettering / arrows visible',
      'No physical damage',
    ],
  },
  {
    id: 'egress-path',
    assetType: 'Egress Path',
    label: 'Egress Path',
    description: 'Corridor, stairwell, or exit route segment',
    defaultItems: [
      'Path unobstructed',
      'Door hardware operational',
      'Floor markings / signage visible',
      'Adequate lighting present',
    ],
  },
  {
    id: 'fire-door',
    assetType: 'Fire Door',
    label: 'Fire Door',
    description: 'Rated fire door assembly',
    defaultItems: [
      'Door closes and latches fully',
      'Self-closing device functional',
      'No gaps / damage to door or frame',
      'Door hardware (hinges, closer) secure',
      'No unauthorized hold-open devices',
    ],
  },
  {
    id: 'sprinkler',
    assetType: 'Sprinkler',
    label: 'Sprinkler Head / System',
    description: 'Individual sprinkler head or riser inspection point',
    defaultItems: [
      'Head unobstructed (18-inch clearance)',
      'No paint, corrosion, or physical damage',
      'Escutcheon plate in place',
      'Control valve open and supervised',
    ],
  },
  {
    id: 'blank',
    assetType: '',
    label: 'Custom / Blank',
    description: 'Start with a blank checklist',
    defaultItems: [],
  },
];

/**
 * Look up a starter by its id.
 */
export function getStarterById(id: string): AssetStarter | undefined {
  return ASSET_STARTERS.find((s) => s.id === id);
}

/**
 * Look up a starter by assetType (case-insensitive).
 */
export function getStarterByType(assetType: string): AssetStarter | undefined {
  const normalized = assetType.trim().toLowerCase();
  return ASSET_STARTERS.find(
    (s) => s.assetType.toLowerCase() === normalized && s.id !== 'blank',
  );
}

/**
 * Convert a starter's default items into CustomAssetInspectionItem[].
 * Returns an empty array for the blank starter.
 */
export function starterToInspectionItems(
  starter: AssetStarter,
): CustomAssetInspectionItem[] {
  return starter.defaultItems.map((label, order) =>
    createInspectionItem(label, order),
  );
}
