/**
 * LocationBreadcrumb — clickable breadcrumb trail for location drill-down navigation.
 *
 * Author: built_by_Beck
 */

import { ChevronRight, Home } from 'lucide-react';
import type { Location } from '../../services/locationService.ts';

interface LocationBreadcrumbProps {
  breadcrumbs: Location[];
  onNavigate: (locationId: string | null) => void;
  rootLabel?: string;
}

export function LocationBreadcrumb({
  breadcrumbs,
  onNavigate,
  rootLabel = 'All Locations',
}: LocationBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <Home className="h-3.5 w-3.5" />
        <span>{rootLabel}</span>
      </button>

      {breadcrumbs.map((loc) => (
        <span key={loc.id} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
          <button
            onClick={() => onNavigate(loc.id!)}
            className="rounded px-1.5 py-0.5 font-medium text-gray-700 hover:bg-gray-100 hover:text-red-600"
          >
            {loc.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
