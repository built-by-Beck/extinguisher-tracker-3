/**
 * FilterPanel — customizable checkbox filter panel for extinguisher lists.
 * Allows filtering by status, category, compliance, and specific location levels.
 *
 * Author: built_by_Beck
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { getLocationTypeLabel, type Location } from '../../services/locationService.ts';

export interface FilterState {
  statuses: Set<string>;
  categories: Set<string>;
  compliance: Set<string>;
  locationIds: Set<string>;
}

export function createEmptyFilters(): FilterState {
  return {
    statuses: new Set(),
    categories: new Set(),
    compliance: new Set(),
    locationIds: new Set(),
  };
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.statuses.size > 0 ||
    filters.categories.size > 0 ||
    filters.compliance.size > 0 ||
    filters.locationIds.size > 0
  );
}

export function countActiveFilters(filters: FilterState): number {
  return (
    filters.statuses.size +
    filters.categories.size +
    filters.compliance.size +
    filters.locationIds.size
  );
}

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  /** Sibling locations at the current drill-down level (for location checkboxes) */
  siblingLocations?: Location[];
  /** Show status filters (for inspections) */
  showStatus?: boolean;
  /** Show category filters (for inventory) */
  showCategory?: boolean;
  /** Show compliance filters (for inventory) */
  showCompliance?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'pass', label: 'Passed', color: 'text-green-600' },
  { value: 'fail', label: 'Failed', color: 'text-red-600' },
  { value: 'pending', label: 'Pending', color: 'text-gray-500' },
];

const CATEGORY_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'spare', label: 'Spare' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'retired', label: 'Retired' },
  { value: 'out_of_service', label: 'Out of Service' },
];

const COMPLIANCE_OPTIONS = [
  { value: 'compliant', label: 'Compliant' },
  { value: 'monthly_due', label: 'Monthly Due' },
  { value: 'annual_due', label: 'Annual Due' },
  { value: 'six_year_due', label: 'Six-Year Due' },
  { value: 'hydro_due', label: 'Hydro Due' },
  { value: 'overdue', label: 'Overdue' },
];

export function FilterPanel({
  filters,
  onChange,
  siblingLocations = [],
  showStatus = true,
  showCategory = false,
  showCompliance = false,
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveFilters(filters);

  function toggleSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function handleStatusToggle(value: string) {
    onChange({ ...filters, statuses: toggleSet(filters.statuses, value) });
  }

  function handleCategoryToggle(value: string) {
    onChange({ ...filters, categories: toggleSet(filters.categories, value) });
  }

  function handleComplianceToggle(value: string) {
    onChange({ ...filters, compliance: toggleSet(filters.compliance, value) });
  }

  function handleLocationToggle(locId: string) {
    onChange({ ...filters, locationIds: toggleSet(filters.locationIds, locId) });
  }

  function clearAll() {
    onChange(createEmptyFilters());
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded filter groups */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex flex-wrap gap-6">
            {/* Status filters */}
            {showStatus && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </p>
                <div className="flex flex-col gap-1.5">
                  {STATUS_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.statuses.has(opt.value)}
                        onChange={() => handleStatusToggle(opt.value)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className={opt.color ?? 'text-gray-700'}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Category filters */}
            {showCategory && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Category
                </p>
                <div className="flex flex-col gap-1.5">
                  {CATEGORY_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.categories.has(opt.value)}
                        onChange={() => handleCategoryToggle(opt.value)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Compliance filters */}
            {showCompliance && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Compliance
                </p>
                <div className="flex flex-col gap-1.5">
                  {COMPLIANCE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.compliance.has(opt.value)}
                        onChange={() => handleComplianceToggle(opt.value)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Location level filters (e.g., specific floors) */}
            {siblingLocations.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Locations
                </p>
                <div className="flex flex-col gap-1.5">
                  {siblingLocations.map((loc) => (
                    <label key={loc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.locationIds.has(loc.id!)}
                        onChange={() => handleLocationToggle(loc.id!)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-gray-700">
                        {loc.name}
                        <span className="ml-1 text-xs text-gray-400">
                          ({getLocationTypeLabel(loc.locationType)})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
