/**
 * Location-aware checksheet generator for field work documents.
 * Deterministic builder from org location tree; AI panel uses this for create intents.
 *
 * Author: built_by_Beck
 */

import type { Location } from './locationService.ts';
import { getAllDescendantIds, getLocationPath } from './locationService.ts';
import {
  createEgressFloorItem,
  createEgressStairwellSection,
} from '../lib/workDocumentTemplates.ts';
import type {
  WorkDocumentCategory,
  WorkDocumentSchema,
} from '../types/workDocument.ts';

export interface GenerateEgressStairwellInput {
  locations: Location[];
  buildingHint?: string;
  title?: string;
}

export interface GeneratedWorkDocumentDraft {
  title: string;
  description: string;
  category: WorkDocumentCategory;
  relatedLocationId: string | null;
  relatedLocationLabel: string | null;
  schema: WorkDocumentSchema;
}

const BUILDING_TYPES = new Set(['building', 'campus', 'warehouse']);
const FLOOR_TYPES = new Set(['floor', 'basement', 'attic', 'parking_deck']);

function normalizeHint(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreNameMatch(name: string, hint: string): number {
  const normalizedName = normalizeHint(name);
  const normalizedHint = normalizeHint(hint);
  if (!normalizedHint) return 0;
  if (normalizedName === normalizedHint) return 100;
  if (normalizedName.includes(normalizedHint)) return 80;
  if (normalizedHint.includes(normalizedName)) return 70;
  const hintTokens = normalizedHint.split(' ').filter(Boolean);
  const nameTokens = new Set(normalizedName.split(' ').filter(Boolean));
  const overlap = hintTokens.filter((token) => nameTokens.has(token)).length;
  return overlap > 0 ? overlap * 10 : 0;
}

export function findBestLocationMatch(
  locations: Location[],
  hint: string,
  preferredTypes?: Set<string>,
): Location | null {
  const trimmed = hint.trim();
  if (!trimmed) return null;

  let best: Location | null = null;
  let bestScore = 0;

  for (const loc of locations) {
    if (!loc.id || loc.deletedAt) continue;
    let score = scoreNameMatch(loc.name, trimmed);
    if (preferredTypes?.has(loc.locationType)) {
      score += 15;
    }
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  }

  return bestScore >= 20 ? best : null;
}

function isStairwell(loc: Location): boolean {
  return loc.locationType === 'stairwell';
}

function isFloorLike(loc: Location): boolean {
  return FLOOR_TYPES.has(loc.locationType);
}

function sortByName(a: Location, b: Location): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function getFloorsForStairwell(
  locations: Location[],
  stairwellId: string,
): Location[] {
  const descendants = getAllDescendantIds(locations, stairwellId);
  return locations
    .filter(
      (loc) =>
        loc.id && descendants.has(loc.id) && isFloorLike(loc) && !loc.deletedAt,
    )
    .sort(sortByName);
}

function getStairwellsUnder(locations: Location[], rootId: string): Location[] {
  const descendants = getAllDescendantIds(locations, rootId);
  const directChildren = locations.filter(
    (loc) => loc.parentLocationId === rootId && loc.id && !loc.deletedAt,
  );

  const stairwells = locations.filter(
    (loc) =>
      loc.id &&
      (loc.id === rootId || descendants.has(loc.id)) &&
      isStairwell(loc) &&
      !loc.deletedAt,
  );

  if (stairwells.length > 0) {
    return stairwells.sort(sortByName);
  }

  return directChildren.filter(isStairwell).sort(sortByName);
}

export function generateEgressStairwellSheet(
  input: GenerateEgressStairwellInput,
): GeneratedWorkDocumentDraft {
  const { locations, buildingHint } = input;
  const building = buildingHint
    ? findBestLocationMatch(locations, buildingHint, BUILDING_TYPES)
    : (locations.find(
        (loc) => BUILDING_TYPES.has(loc.locationType) && !loc.deletedAt,
      ) ?? null);

  const buildingLabel = building
    ? getLocationPath(locations, building.id!)
    : buildingHint?.trim() || 'All buildings';

  const stairwells = building?.id
    ? getStairwellsUnder(locations, building.id)
    : locations
        .filter((loc) => isStairwell(loc) && !loc.deletedAt)
        .sort(sortByName);

  const sections =
    stairwells.length > 0
      ? stairwells.map((stairwell) => {
          const floors = stairwell.id
            ? getFloorsForStairwell(locations, stairwell.id)
            : [];
          const items =
            floors.length > 0
              ? floors.map((floor, index) =>
                  createEgressFloorItem(
                    floor.name,
                    floor.id ?? null,
                    index + 1,
                  ),
                )
              : [
                  createEgressFloorItem(
                    `${stairwell.name} — landing / general check`,
                    stairwell.id ?? null,
                  ),
                ];

          return createEgressStairwellSection(
            stairwell.name,
            items,
            floors.length > 0
              ? `${floors.length} floor(s) under this stairwell`
              : 'Add floor locations under this stairwell for per-floor rows',
          );
        })
      : [
          createEgressStairwellSection(
            'Stairwell checks',
            [
              createEgressFloorItem(
                'Stairwell A — add locations to auto-populate',
              ),
            ],
            'No stairwell locations found. Tag stairwells in Locations, then regenerate or edit manually.',
          ),
        ];

  const title =
    input.title?.trim() ||
    `Egress lighting — stairwell checks (${building?.name ?? 'org'})`;

  return {
    title,
    description: `Printable egress lighting and exit sign checks for stairwells in ${buildingLabel}. Pass/fail columns are for field use on paper; in-app walk completion will be added later.`,
    category: 'egress_lighting',
    relatedLocationId: building?.id ?? null,
    relatedLocationLabel: building ? buildingLabel : null,
    schema: {
      sections,
      printNotes:
        'Walk each stairwell landing. Circle P (pass), F (fail), or N/A for each line. Most teams pass items on site and note fixes in the Notes column.',
      footerText:
        'Inspector: __________________  Date: __________  Building: ' +
        (building?.name ?? '__________'),
    },
  };
}

export interface WorkDocumentIntent {
  kind: 'egress_stairwell';
  buildingHint: string | null;
  rawPrompt: string;
}

const WORK_DOC_INTENT_PATTERN =
  /\b(?:create|make|generate|build)\b[\s\S]{0,80}?\b(?:check\s*sheet|checksheet|work\s*sheet|worksheet|field\s*work\s*doc(?:ument)?|document)\b/i;

const STAIRWELL_HINT_PATTERN =
  /\b(?:stair\s*well|stairwell)\b[\s\S]{0,120}?\b(?:in|for|at)\b\s+(.+?)(?:\.|$)/i;

const BUILDING_HINT_PATTERN = /\bbuilding\s+([a-z0-9][\w\s-]*)/i;

const EGRESS_PATTERN = /\b(?:egress|exit\s+(?:light|sign)|emergency\s+light)/i;

export function parseWorkDocumentIntent(
  message: string,
): WorkDocumentIntent | null {
  if (!WORK_DOC_INTENT_PATTERN.test(message)) {
    return null;
  }

  const lower = message.toLowerCase();
  const isEgress =
    EGRESS_PATTERN.test(lower) ||
    /\blight(?:ing)?\b/.test(lower) ||
    /\bexit\b/.test(lower);

  if (!isEgress && !/\bstair\b/.test(lower)) {
    return null;
  }

  const stairwellMatch = message.match(STAIRWELL_HINT_PATTERN);
  const buildingMatch = message.match(BUILDING_HINT_PATTERN);
  const buildingHint =
    stairwellMatch?.[1]?.trim() || buildingMatch?.[1]?.trim() || null;

  return {
    kind: 'egress_stairwell',
    buildingHint,
    rawPrompt: message.trim(),
  };
}
