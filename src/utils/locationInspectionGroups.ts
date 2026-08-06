/**
 * Group inspections by hierarchy location or denormalized floor (compat).
 *
 * Author: built_by_Beck
 */

import type { Extinguisher } from '../services/extinguisherService.ts';
import type { Inspection } from '../services/inspectionService.ts';
import {
  findAncestorOfType,
  getAllDescendantIds,
  isFloorLevelType,
  type Location,
} from '../services/locationService.ts';
import { floorSortRank } from './floorParsing.ts';

const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function cmpNatural(a: string, b: string): number {
  return NATURAL_COLLATOR.compare(a, b);
}

function norm(v: unknown): string {
  return (v ?? '').toString().trim();
}

export interface InspectionLocationGroup {
  key: string;
  label: string;
  orderKey: string;
  inspections: Inspection[];
}

function getLocationPathLabel(
  locationId: string | null | undefined,
  locById: ReadonlyMap<string, Location>,
): string {
  if (!locationId || locationId === '__unassigned__') return 'Unassigned';
  const parts: string[] = [];
  let current = locById.get(locationId);
  while (current) {
    parts.unshift(current.name);
    if (!current.parentLocationId) break;
    current = locById.get(current.parentLocationId);
  }
  return parts.length > 0 ? parts.join(' > ') : 'Unassigned';
}

function getLocationPathSortOrder(
  locationId: string | null | undefined,
  locById: ReadonlyMap<string, Location>,
): string {
  if (!locationId || locationId === '__unassigned__') return 'zzz-unassigned';
  const parts: string[] = [];
  let current = locById.get(locationId);
  while (current) {
    const order = Number.isFinite(current.sortOrder)
      ? String(current.sortOrder).padStart(6, '0')
      : '999999';
    parts.unshift(`${order}:${current.name.toLowerCase()}`);
    if (!current.parentLocationId) break;
    current = locById.get(current.parentLocationId);
  }
  return parts.join('>');
}

/**
 * Resolve a stable group key/label for an inspection under the current drill scope.
 * Prefer floor hierarchy nodes; fall back to denormalized extinguisher.floor when
 * the unit is pinned to the building (legacy import data).
 */
export function resolveInspectionGroupMeta(params: {
  insp: Inspection;
  locById: ReadonlyMap<string, Location>;
  locations: Location[];
  extinguishersById: ReadonlyMap<string, Extinguisher>;
  scopeLocationId: string | null;
}): { key: string; label: string; orderKey: string } {
  const { insp, locById, locations, extinguishersById, scopeLocationId } =
    params;
  const locId = insp.locationId ?? null;
  const ext = extinguishersById.get(insp.extinguisherId);

  const floorAncestor = findAncestorOfType(locations, locId, [
    'floor',
    'basement',
    'parking_deck',
    'roof',
  ]);

  // When scoped to a building, collapse children under their floor when possible.
  if (scopeLocationId) {
    const scopeLoc = locById.get(scopeLocationId);
    if (scopeLoc && !isFloorLevelType(scopeLoc.locationType)) {
      if (floorAncestor?.id) {
        return {
          key: floorAncestor.id,
          label: floorAncestor.name,
          orderKey: getLocationPathSortOrder(floorAncestor.id, locById),
        };
      }
      // Compat: unit assigned to building (or scope) with only denormalized floor text
      const denormFloor = (ext?.floor ?? '').trim();
      if (
        denormFloor &&
        (!locId ||
          locId === scopeLocationId ||
          !getAllDescendantIds(locations, scopeLocationId).has(locId))
      ) {
        const key = `floor-label:${denormFloor.toLowerCase()}`;
        return {
          key,
          label: denormFloor,
          orderKey: `floor:${String(floorSortRank(denormFloor)).padStart(6, '0')}:${denormFloor.toLowerCase()}`,
        };
      }
    }
  }

  if (!locId) {
    const denormFloor = (ext?.floor ?? '').trim();
    if (denormFloor) {
      return {
        key: `floor-label:${denormFloor.toLowerCase()}`,
        label: denormFloor,
        orderKey: `floor:${String(floorSortRank(denormFloor)).padStart(6, '0')}:${denormFloor.toLowerCase()}`,
      };
    }
    return {
      key: '__unassigned__',
      label: 'Unassigned',
      orderKey: 'zzz-unassigned',
    };
  }

  return {
    key: locId,
    label: getLocationPathLabel(locId, locById),
    orderKey: getLocationPathSortOrder(locId, locById),
  };
}

export function groupInspectionsByLocationOrFloor(params: {
  inspections: Inspection[];
  locations: Location[];
  extinguishers: Extinguisher[];
  scopeLocationId: string | null;
  assetDir?: 'asc' | 'desc';
}): InspectionLocationGroup[] {
  const {
    inspections,
    locations,
    extinguishers,
    scopeLocationId,
    assetDir = 'asc',
  } = params;
  const locById = new Map<string, Location>();
  for (const loc of locations) {
    if (loc.id) locById.set(loc.id, loc);
  }
  const extinguishersById = new Map<string, Extinguisher>();
  for (const e of extinguishers) {
    if (e.id) extinguishersById.set(e.id, e);
  }

  const groups = new Map<string, InspectionLocationGroup>();
  for (const insp of inspections) {
    const meta = resolveInspectionGroupMeta({
      insp,
      locById,
      locations,
      extinguishersById,
      scopeLocationId,
    });
    let group = groups.get(meta.key);
    if (!group) {
      group = {
        key: meta.key,
        label: meta.label,
        orderKey: meta.orderKey,
        inspections: [],
      };
      groups.set(meta.key, group);
    }
    group.inspections.push(insp);
  }

  const dir = assetDir === 'asc' ? 1 : -1;
  return Array.from(groups.values())
    .sort((a, b) => cmpNatural(a.orderKey, b.orderKey))
    .map((group) => ({
      ...group,
      inspections: [...group.inspections].sort(
        (a, b) => cmpNatural(norm(a.assetId), norm(b.assetId)) * dir,
      ),
    }));
}
