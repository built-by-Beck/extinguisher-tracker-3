/**
 * Plan permanent floor-label cleanup without rewriting data on page load.
 * Used by Data Organizer / admin tooling.
 *
 * Author: built_by_Beck
 */

import type { Location } from '../services/locationService.ts';
import {
  isFloorLikeLocationType,
  normalizeFloorLabel,
} from './floorParsing.ts';

export interface FloorLocationRenamePlan {
  locationId: string;
  fromName: string;
  toName: string;
}

export interface FloorLocationMergePlan {
  /** Keep this location; reassign extinguishers/inspections from sources. */
  keepLocationId: string;
  keepName: string;
  sourceLocationIds: string[];
  sourceNames: string[];
  parentLocationId: string | null;
}

export interface FloorCleanupPlan {
  renames: FloorLocationRenamePlan[];
  merges: FloorLocationMergePlan[];
}

/**
 * Build a cleanup plan: rename floor locations to canonical labels, then merge
 * siblings under the same parent that share a canonical label.
 */
export function planFloorLocationCleanup(
  locations: Location[],
): FloorCleanupPlan {
  const floors = locations.filter(
    (l) =>
      l.deletedAt == null &&
      l.id &&
      isFloorLikeLocationType(l.locationType),
  );

  const renames: FloorLocationRenamePlan[] = [];
  for (const floor of floors) {
    const canonical = normalizeFloorLabel(floor.name);
    if (canonical && canonical !== floor.name.trim()) {
      renames.push({
        locationId: floor.id!,
        fromName: floor.name,
        toName: canonical,
      });
    }
  }

  // After renames, group by parent + canonical name
  const groups = new Map<string, Location[]>();
  for (const floor of floors) {
    const canonical =
      normalizeFloorLabel(floor.name) ?? floor.name.trim();
    const key = `${floor.parentLocationId ?? 'root'}::${canonical.toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(floor);
    groups.set(key, list);
  }

  const merges: FloorLocationMergePlan[] = [];
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    // Prefer the location already named canonically; else first by id
    const canonical = normalizeFloorLabel(group[0].name) ?? group[0].name.trim();
    const keep =
      group.find((g) => g.name.trim() === canonical) ??
      [...group].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))[0];
    const sources = group.filter((g) => g.id !== keep.id);
    merges.push({
      keepLocationId: keep.id!,
      keepName: canonical,
      sourceLocationIds: sources.map((s) => s.id!),
      sourceNames: sources.map((s) => s.name),
      parentLocationId: keep.parentLocationId,
    });
  }

  return { renames, merges };
}
