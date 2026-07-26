/**
 * Generate-from-Locations helper for Custom Assets.
 *
 * Walks the org location tree and produces a set of CreateAssetInput records:
 * one per floor under each stairwell (or the stairwell itself when it has no
 * floor descendants), all scoped to a chosen starter.
 *
 * Pure function — no Firestore calls. Callers persist with createAsset().
 *
 * Author: built_by_Beck
 */

import type { Location } from '../services/locationService.ts';
import { getAllDescendantIds } from '../services/locationService.ts';
import type { CreateAssetInput } from '../services/assetService.ts';
import { starterToInspectionItems } from './customAssetStarters.ts';
import type { AssetStarter } from './customAssetStarters.ts';

// ─── location-walk helpers (duplicated from workDocumentGenerator to avoid
//     coupling Field Work documents to custom assets) ─────────────────────────

const FLOOR_TYPES = new Set(['floor', 'basement', 'attic', 'parking_deck']);
const BUILDING_TYPES = new Set(['building', 'campus', 'warehouse']);

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
  const stairwells = locations.filter(
    (loc) =>
      loc.id &&
      (loc.id === rootId || descendants.has(loc.id)) &&
      isStairwell(loc) &&
      !loc.deletedAt,
  );
  if (stairwells.length > 0) return stairwells.sort(sortByName);
  // fall back to direct stairwell children of rootId
  return locations
    .filter(
      (loc) =>
        loc.parentLocationId === rootId &&
        loc.id &&
        !loc.deletedAt &&
        isStairwell(loc),
    )
    .sort(sortByName);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateFromLocationsInput {
  /** All org locations (active + deleted; filtering done internally). */
  locations: Location[];
  /**
   * Optional root building/campus to scope stairwell search.
   * When null / undefined, all stairwells in the org are used.
   */
  rootLocationId?: string | null;
  /** Starter to apply — determines assetType and default inspection columns. */
  starter: AssetStarter;
  /**
   * Already-existing assets to check for duplicates.
   * A generated asset is skipped if an active asset with the same
   * (name, locationId) already exists.
   */
  existingAssets?: Array<{ name: string; locationId?: string | null }>;
}

export interface GenerateFromLocationsResult {
  inputs: CreateAssetInput[];
  /** Names of locations that were skipped because a duplicate asset existed. */
  skippedDuplicates: string[];
}

/**
 * Generate one CreateAssetInput per floor under each stairwell (or the
 * stairwell itself when it has no floor descendants).
 *
 * Asset names use the pattern: "<stairwell name>" or "<stairwell> — <floor>".
 */
export function generateAssetsFromLocations(
  input: GenerateFromLocationsInput,
): GenerateFromLocationsResult {
  const { locations, rootLocationId, starter, existingAssets = [] } = input;

  // Build a fast duplicate-check set: "name:::locationId"
  const dupSet = new Set<string>();
  for (const asset of existingAssets) {
    dupSet.add(`${asset.name.trim()}:::${asset.locationId ?? ''}`);
  }

  // Find stairwells to iterate
  const stairwells = rootLocationId
    ? getStairwellsUnder(locations, rootLocationId)
    : locations
        .filter((loc) => isStairwell(loc) && !loc.deletedAt && loc.id)
        .sort(sortByName);

  // If no stairwells, fall back to generating one asset per non-deleted
  // non-building child of the root (or just a single asset for the root itself)
  // when the starter isn't stairwell-specific. For now, return empty with a note.
  if (stairwells.length === 0 && rootLocationId) {
    // Try generating one per direct non-deleted child location under root
    const children = locations
      .filter(
        (loc) =>
          loc.parentLocationId === rootLocationId &&
          loc.id &&
          !loc.deletedAt &&
          !BUILDING_TYPES.has(loc.locationType),
      )
      .sort(sortByName);

    return generateFromLocationList(children, starter, dupSet);
  }

  const inputs: CreateAssetInput[] = [];
  const skippedDuplicates: string[] = [];

  for (const stairwell of stairwells) {
    if (!stairwell.id) continue;
    const floors = getFloorsForStairwell(locations, stairwell.id);

    if (floors.length === 0) {
      // One asset for the stairwell itself
      const name = starter.assetType
        ? `${stairwell.name} — ${starter.assetType}`
        : stairwell.name;
      const dupKey = `${name.trim()}:::${stairwell.id}`;
      if (dupSet.has(dupKey)) {
        skippedDuplicates.push(name);
        continue;
      }
      inputs.push(buildInput(name, stairwell.id, starter));
    } else {
      for (const floor of floors) {
        if (!floor.id) continue;
        const name = starter.assetType
          ? `${stairwell.name} — ${floor.name} — ${starter.assetType}`
          : `${stairwell.name} — ${floor.name}`;
        const dupKey = `${name.trim()}:::${floor.id}`;
        if (dupSet.has(dupKey)) {
          skippedDuplicates.push(name);
          continue;
        }
        inputs.push(buildInput(name, floor.id, starter));
      }
    }
  }

  return { inputs, skippedDuplicates };
}

function generateFromLocationList(
  locs: Location[],
  starter: AssetStarter,
  dupSet: Set<string>,
): GenerateFromLocationsResult {
  const inputs: CreateAssetInput[] = [];
  const skippedDuplicates: string[] = [];

  for (const loc of locs) {
    if (!loc.id) continue;
    const name = starter.assetType
      ? `${loc.name} — ${starter.assetType}`
      : loc.name;
    const dupKey = `${name.trim()}:::${loc.id}`;
    if (dupSet.has(dupKey)) {
      skippedDuplicates.push(name);
      continue;
    }
    inputs.push(buildInput(name, loc.id, starter));
  }

  return { inputs, skippedDuplicates };
}

function buildInput(
  name: string,
  locationId: string,
  starter: AssetStarter,
): CreateAssetInput {
  return {
    name,
    assetType: starter.assetType || undefined,
    locationId,
    recurrence: 'monthly',
    templateId: null,
    inspectionItems: starterToInspectionItems(starter),
  };
}

/**
 * Return the set of building/campus locations that contain at least one
 * stairwell descendant (for the "under a building" picker in the UI).
 */
export function getBuildingsWithStairwells(locations: Location[]): Location[] {
  return locations
    .filter((loc) => {
      if (!loc.id || loc.deletedAt) return false;
      if (!BUILDING_TYPES.has(loc.locationType)) return false;
      const desc = getAllDescendantIds(locations, loc.id);
      return locations.some(
        (l) => l.id && desc.has(l.id) && isStairwell(l) && !l.deletedAt,
      );
    })
    .sort(sortByName);
}
