/**
 * SortableTableHeader — reusable clickable column header with sort indicators.
 *
 * Author: built_by_Beck
 */

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  activeSortKey: string;
  activeSortDir: 'asc' | 'desc';
  onToggle: (key: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

export function SortableTableHeader({
  label,
  sortKey,
  activeSortKey,
  activeSortDir,
  onToggle,
  className = '',
  align = 'left',
}: SortableTableHeaderProps) {
  const isActive = activeSortKey === sortKey;

  return (
    <th
      onClick={() => onToggle(sortKey)}
      className={`cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 transition-colors ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          activeSortDir === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-red-500" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" />
        )}
      </span>
    </th>
  );
}
