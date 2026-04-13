/**
 * GuestLocations — read-only location hierarchy for guest access.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { MapPin, ChevronRight, ChevronDown } from 'lucide-react';
import { useGuest } from '../../hooks/useGuest.ts';
import {
  subscribeToLocations,
  buildLocationTree,
  getLocationTypeLabel,
  type Location,
  type LocationTreeNode,
} from '../../services/locationService.ts';

function ReadOnlyTreeNode({ node, depth }: { node: LocationTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{node.name}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
            Level {depth + 1}
          </span>
        </div>
        <span className="text-xs text-gray-400">{getLocationTypeLabel(node.locationType)}</span>
        {node.description && (
          <span className="max-w-xs truncate text-xs text-gray-400">{node.description}</span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <ReadOnlyTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GuestLocations() {
  const { guestOrgId } = useGuest();
  const orgId = guestOrgId ?? '';

  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  const tree = buildLocationTree(locations);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <MapPin className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500">
            {locations.length} location{locations.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tree */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {tree.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No locations defined.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tree.map((node) => (
              <ReadOnlyTreeNode key={node.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
