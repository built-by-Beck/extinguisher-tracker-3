/**
 * LocationSelector — hierarchical location dropdown with full path display.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.ts';
import {
  subscribeToLocations,
  buildLocationTree,
  type Location,
  type LocationTreeNode,
} from '../../services/locationService.ts';

interface LocationSelectorProps {
  value: string | null;
  onChange: (locationId: string | null) => void;
}

/**
 * Flatten the tree in depth-first order for indented display.
 */
function flattenTree(nodes: LocationTreeNode[], depth: number = 0): Array<{ loc: Location; depth: number }> {
  const result: Array<{ loc: Location; depth: number }> = [];
  for (const node of nodes) {
    result.push({ loc: node, depth });
    result.push(...flattenTree(node.children, depth + 1));
  }
  return result;
}

export function LocationSelector({ value, onChange }: LocationSelectorProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  if (locations.length === 0) {
    return (
      <div className="text-sm text-gray-400">
        <MapPin className="mr-1 inline h-4 w-4" />
        No locations defined. Add locations in the Locations page.
      </div>
    );
  }

  const tree = buildLocationTree(locations);
  const flattened = flattenTree(tree);

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
    >
      <option value="">-- All Locations --</option>
      {flattened.map(({ loc, depth }) => (
        <option key={loc.id} value={loc.id}>
          {'  '.repeat(depth)}{depth > 0 ? '└ ' : ''}{loc.name} ({loc.locationType})
        </option>
      ))}
    </select>
  );
}
