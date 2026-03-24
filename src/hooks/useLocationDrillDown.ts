/**
 * useLocationDrillDown — manages hierarchical location navigation state.
 *
 * Provides a drill-down state machine for navigating:
 * Root (all top-level locations) → Building → Floor → Leaf (extinguisher list)
 *
 * Author: built_by_Beck
 */

import { useState, useMemo, useCallback } from 'react';
import {
  buildLocationTree,
  getAncestorChain,
  getAllDescendantIds,
  type Location,
  type LocationTreeNode,
} from '../services/locationService.ts';

export interface UseLocationDrillDownReturn {
  /** Current location ID (null = root level showing top-level locations) */
  currentLocationId: string | null;
  /** Current location object (null at root) */
  currentLocation: Location | null;
  /** Children of the current location (next level to show as cards) */
  currentChildren: LocationTreeNode[];
  /** Whether the current location is a leaf (no children — show extinguisher list) */
  isLeaf: boolean;
  /** Whether we're at root level */
  isRoot: boolean;
  /** Breadcrumb trail from root to current location */
  breadcrumbs: Location[];
  /** Navigate into a child location */
  navigateTo: (locationId: string) => void;
  /** Navigate up one level */
  navigateUp: () => void;
  /** Navigate to root */
  navigateToRoot: () => void;
  /** Navigate to a specific ancestor in the breadcrumb */
  navigateToBreadcrumb: (locationId: string | null) => void;
  /** Get all descendant location IDs for a given location (for filtering) */
  getDescendants: (locationId: string) => Set<string>;
  /** Get all location IDs at or below the current location */
  currentLocationAndDescendants: Set<string>;
}

export function useLocationDrillDown(locations: Location[]): UseLocationDrillDownReturn {
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);

  const tree = useMemo(() => buildLocationTree(locations), [locations]);

  const locationMap = useMemo(() => {
    return new Map(locations.map((l) => [l.id!, l]));
  }, [locations]);

  const currentLocation = useMemo(() => {
    if (!currentLocationId) return null;
    return locationMap.get(currentLocationId) ?? null;
  }, [currentLocationId, locationMap]);

  // Build a tree node map for quick child lookup
  const treeNodeMap = useMemo(() => {
    const map = new Map<string, LocationTreeNode>();
    function walk(nodes: LocationTreeNode[]) {
      for (const node of nodes) {
        map.set(node.id!, node);
        walk(node.children);
      }
    }
    walk(tree);
    return map;
  }, [tree]);

  const currentChildren = useMemo(() => {
    if (!currentLocationId) return tree;
    const node = treeNodeMap.get(currentLocationId);
    return node?.children ?? [];
  }, [currentLocationId, tree, treeNodeMap]);

  const isLeaf = currentLocationId !== null && currentChildren.length === 0;
  const isRoot = currentLocationId === null;

  const breadcrumbs = useMemo(() => {
    if (!currentLocationId) return [];
    const ancestors = getAncestorChain(locations, currentLocationId);
    const current = locationMap.get(currentLocationId);
    if (current) ancestors.push(current);
    return ancestors;
  }, [currentLocationId, locations, locationMap]);

  const navigateTo = useCallback((locationId: string) => {
    setCurrentLocationId(locationId);
  }, []);

  const navigateUp = useCallback(() => {
    if (!currentLocationId) return;
    const current = locationMap.get(currentLocationId);
    setCurrentLocationId(current?.parentLocationId ?? null);
  }, [currentLocationId, locationMap]);

  const navigateToRoot = useCallback(() => {
    setCurrentLocationId(null);
  }, []);

  const navigateToBreadcrumb = useCallback((locationId: string | null) => {
    setCurrentLocationId(locationId);
  }, []);

  const getDescendants = useCallback(
    (locationId: string) => getAllDescendantIds(locations, locationId),
    [locations],
  );

  const currentLocationAndDescendants = useMemo(() => {
    if (!currentLocationId) {
      // At root, all locations
      return new Set(locations.map((l) => l.id!));
    }
    const descendants = getAllDescendantIds(locations, currentLocationId);
    descendants.add(currentLocationId);
    return descendants;
  }, [currentLocationId, locations]);

  return {
    currentLocationId,
    currentLocation,
    currentChildren,
    isLeaf,
    isRoot,
    breadcrumbs,
    navigateTo,
    navigateUp,
    navigateToRoot,
    navigateToBreadcrumb,
    getDescendants,
    currentLocationAndDescendants,
  };
}
