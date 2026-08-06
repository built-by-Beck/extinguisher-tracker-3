/**
 * Build a building → floor tree for the inspection workspace location panel.
 * Merges duplicate floor labels (via normalizeFloorLabel) for display without
 * rewriting Firestore records.
 *
 * Author: built_by_Beck
 */

import type { Location } from '../services/locationService.ts';
import { getAllDescendantIds } from '../services/locationService.ts';
import {
  floorSortRank,
  isFloorLikeLocationType,
  normalizeFloorLabel,
} from './floorParsing.ts';

export type InspectionScopeFilter =
  | 'pending'
  | 'pass'
  | 'fail'
  | 'checked'
  | 'replaced'
  | 'all';

export interface InspectionLocationNode {
  /** Stable selection key (location id, or synthetic merge key). */
  key: string;
  /** Canonical display name. */
  name: string;
  /** Real Firestore location IDs this node covers. */
  locationIds: string[];
  kind: 'building' | 'floor' | 'other';
  children: InspectionLocationNode[];
  /** Count for the active scope (filled by attachScopeCounts). */
  count: number;
}

function isBuildingLike(type: string): boolean {
  const t = type.toLowerCase();
  return t === 'building' || t === 'campus' || t === 'site';
}

function displayNameForLocation(loc: Location): string {
  if (isFloorLikeLocationType(loc.locationType)) {
    return normalizeFloorLabel(loc.name) ?? loc.name.trim();
  }
  return loc.name.trim();
}

/**
 * Top-level buildings (and campuses) with floor children merged by canonical label.
 * Non-floor children of a building are ignored in the tree (still counted via descendants).
 */
export function buildInspectionLocationTree(
  locations: Location[],
): InspectionLocationNode[] {
  const active = locations.filter((l) => l.deletedAt == null && l.id);
  const byParent = new Map<string | null, Location[]>();
  for (const loc of active) {
    const parent = loc.parentLocationId;
    const list = byParent.get(parent) ?? [];
    list.push(loc);
    byParent.set(parent, list);
  }

  const roots = (byParent.get(null) ?? []).filter(
    (l) => isBuildingLike(l.locationType) || !l.parentLocationId,
  );

  // Prefer buildings; if campus has building children, use buildings as roots.
  const buildingRoots: Location[] = [];
  for (const root of roots) {
    const children = byParent.get(root.id!) ?? [];
    const buildingChildren = children.filter((c) =>
      isBuildingLike(c.locationType),
    );
    if (buildingChildren.length > 0) {
      buildingRoots.push(...buildingChildren);
    } else if (isBuildingLike(root.locationType) || children.length > 0) {
      buildingRoots.push(root);
    } else {
      buildingRoots.push(root);
    }
  }

  // Deduplicate roots by id
  const seen = new Set<string>();
  const uniqueRoots = buildingRoots.filter((b) => {
    if (!b.id || seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  uniqueRoots.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );

  return uniqueRoots.map((building) => {
    const descendants = getAllDescendantIds(active, building.id!);
    const floorLocs = active.filter(
      (l) =>
        l.id &&
        descendants.has(l.id) &&
        isFloorLikeLocationType(l.locationType),
    );

    const mergeMap = new Map<string, Location[]>();
    for (const floor of floorLocs) {
      const label = displayNameForLocation(floor);
      const mergeKey = normalizeFloorLabel(label)?.toLowerCase() ?? label.toLowerCase();
      const list = mergeMap.get(mergeKey) ?? [];
      list.push(floor);
      mergeMap.set(mergeKey, list);
    }

    const floorNodes: InspectionLocationNode[] = [...mergeMap.entries()]
      .map(([, locs]) => {
        const name = displayNameForLocation(locs[0]);
        const ids = locs.map((l) => l.id!).filter(Boolean);
        return {
          key: ids.length === 1 ? ids[0] : `merge:${building.id}:${name}`,
          name,
          locationIds: ids,
          kind: 'floor' as const,
          children: [],
          count: 0,
        };
      })
      .sort((a, b) => floorSortRank(a.name) - floorSortRank(b.name));

    return {
      key: building.id!,
      name: building.name.trim(),
      locationIds: [building.id!],
      kind: 'building' as const,
      children: floorNodes,
      count: 0,
    };
  });
}

export function findInspectionLocationNode(
  tree: InspectionLocationNode[],
  key: string | null,
): InspectionLocationNode | null {
  if (!key) return null;
  for (const building of tree) {
    if (building.key === key) return building;
    for (const floor of building.children) {
      if (floor.key === key) return floor;
      if (floor.locationIds.includes(key)) return floor;
    }
    if (building.locationIds.includes(key)) return building;
  }
  return null;
}

/** Resolve selection to concrete location IDs (building includes all descendants). */
export function resolveSelectionLocationIds(
  tree: InspectionLocationNode[],
  locations: Location[],
  selectedKey: string | null,
): string[] | null {
  if (!selectedKey) return null;
  const node = findInspectionLocationNode(tree, selectedKey);
  if (!node) {
    // Fallback: treat as raw location id
    if (locations.some((l) => l.id === selectedKey)) {
      const descendants = getAllDescendantIds(locations, selectedKey);
      descendants.add(selectedKey);
      return [...descendants];
    }
    return null;
  }
  if (node.kind === 'building') {
    const descendants = getAllDescendantIds(locations, node.locationIds[0]);
    descendants.add(node.locationIds[0]);
    return [...descendants];
  }
  return [...node.locationIds];
}

export function attachScopeCounts(
  tree: InspectionLocationNode[],
  countByLocationId: Map<string, number>,
  locations: Location[],
): InspectionLocationNode[] {
  return tree.map((building) => {
    const buildingIds = resolveSelectionLocationIds(
      tree,
      locations,
      building.key,
    );
    let buildingCount = 0;
    if (buildingIds) {
      for (const id of buildingIds) {
        buildingCount += countByLocationId.get(id) ?? 0;
      }
    }

    const children = building.children.map((floor) => {
      let floorCount = 0;
      for (const id of floor.locationIds) {
        floorCount += countByLocationId.get(id) ?? 0;
      }
      return { ...floor, count: floorCount };
    });

    return { ...building, count: buildingCount, children };
  });
}
