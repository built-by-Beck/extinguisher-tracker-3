/**
 * LocationExplorer — compact building/floor tree for the inspection workspace.
 *
 * Author: built_by_Beck
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, X } from 'lucide-react';
import type { InspectionLocationNode } from '../../utils/inspectionLocationTree.ts';

interface LocationExplorerProps {
  tree: InspectionLocationNode[];
  totalCount: number;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** Controlled expanded building keys; uncontrolled if omitted. */
  expandedKeys?: Set<string>;
  onExpandedChange?: (keys: Set<string>) => void;
  className?: string;
}

export function LocationExplorer({
  tree,
  totalCount,
  selectedKey,
  onSelect,
  expandedKeys: controlledExpanded,
  onExpandedChange,
  className = '',
}: LocationExplorerProps) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(
    () => new Set(),
  );
  const expanded = controlledExpanded ?? internalExpanded;

  function setExpanded(next: Set<string>) {
    if (onExpandedChange) onExpandedChange(next);
    else setInternalExpanded(next);
  }

  // Auto-expand the building that contains the selected floor.
  useEffect(() => {
    if (!selectedKey) return;
    for (const building of tree) {
      if (
        building.children.some(
          (f) => f.key === selectedKey || f.locationIds.includes(selectedKey),
        )
      ) {
        if (!expanded.has(building.key)) {
          const next = new Set(expanded);
          next.add(building.key);
          setExpanded(next);
        }
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to selection changes
  }, [selectedKey, tree]);

  function toggleBuilding(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  }

  const allSelected = selectedKey == null;

  return (
    <nav
      aria-label="Locations"
      className={`flex h-full flex-col border-r border-gray-200 bg-white ${className}`}
    >
      <div className="shrink-0 border-b border-gray-100 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Locations
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
            allSelected
              ? 'bg-red-50 font-semibold text-red-800 ring-1 ring-red-200'
              : 'text-gray-800 hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
            All Locations
          </span>
          <span
            className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
              allSelected ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {totalCount}
          </span>
        </button>

        <ul className="mt-1 space-y-0.5" role="tree">
          {tree.map((building) => {
            const isExpanded = expanded.has(building.key);
            const isSelected = selectedKey === building.key;
            const hasFloors = building.children.length > 0;
            return (
              <li key={building.key} role="treeitem" aria-expanded={hasFloors ? isExpanded : undefined}>
                <div className="flex items-stretch gap-0.5">
                  {hasFloors ? (
                    <button
                      type="button"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${building.name}`}
                      onClick={() => toggleBuilding(building.key)}
                      className="flex w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <span className="w-7 shrink-0" aria-hidden />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect(building.key)}
                    className={`flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                      isSelected
                        ? 'bg-red-50 font-semibold text-red-800 ring-1 ring-red-200'
                        : 'text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{building.name}</span>
                    <span
                      className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                        isSelected
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {building.count}
                    </span>
                  </button>
                </div>
                {hasFloors && isExpanded && (
                  <ul className="ml-7 mt-0.5 space-y-0.5 border-l border-gray-100 pl-1" role="group">
                    {building.children.map((floor) => {
                      const floorSelected = selectedKey === floor.key;
                      return (
                        <li key={floor.key} role="treeitem">
                          <button
                            type="button"
                            onClick={() => onSelect(floor.key)}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs ${
                              floorSelected
                                ? 'bg-red-50 font-semibold text-red-800 ring-1 ring-red-200'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="truncate">{floor.name}</span>
                            <span
                              className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                                floorSelected
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {floor.count}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

interface MobileLocationDrawerProps {
  open: boolean;
  onClose: () => void;
  tree: InspectionLocationNode[];
  totalCount: number;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}

export function MobileLocationDrawer({
  open,
  onClose,
  tree,
  totalCount,
  selectedKey,
  onSelect,
}: MobileLocationDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Locations">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close locations"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
          <p className="text-sm font-semibold text-gray-900">Locations</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <LocationExplorer
          tree={tree}
          totalCount={totalCount}
          selectedKey={selectedKey}
          onSelect={(key) => {
            onSelect(key);
            onClose();
          }}
          className="min-h-0 flex-1 border-r-0"
        />
      </div>
    </div>
  );
}
