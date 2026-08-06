/**
 * Compact extinguisher list for the inspection workspace master-detail layout.
 *
 * Author: built_by_Beck
 */

import { STATUS_STYLES } from './InspectionRowCard.tsx';
import type { Inspection } from '../../services/inspectionService.ts';

export interface ExtinguisherListRowModel {
  inspection: Inspection;
  vicinity: string;
  serial: string;
}

interface ExtinguisherCompactListProps {
  rows: ExtinguisherListRowModel[];
  isArchived: boolean;
  onInspect: (inspection: Inspection) => void;
  emptyMessage?: string;
}

export function ExtinguisherCompactList({
  rows,
  isArchived,
  onInspect,
  emptyMessage = 'No extinguishers match this location and filter.',
}: ExtinguisherCompactListProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_7rem_6.5rem] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <span>Asset ID</span>
          <span>Vicinity</span>
          <span>Serial</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {rows.map(({ inspection, vicinity, serial }) => {
            const style =
              STATUS_STYLES[inspection.status] ?? STATUS_STYLES.pending;
            return (
              <li key={inspection.id ?? `${inspection.extinguisherId}-${inspection.assetId}`}>
                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_7rem_6.5rem] items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {inspection.assetId || '—'}
                  </span>
                  <span className="truncate text-sm text-gray-600">
                    {vicinity || '—'}
                  </span>
                  <span className="truncate text-sm text-gray-500">
                    {serial || '—'}
                  </span>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.color}`}
                  >
                    {style.label}
                  </span>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => onInspect(inspection)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        isArchived
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {isArchived ? 'View' : 'Inspect'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mobile compact cards */}
      <ul className="divide-y divide-gray-100 md:hidden">
        {rows.map(({ inspection, vicinity, serial }) => {
          const style =
            STATUS_STYLES[inspection.status] ?? STATUS_STYLES.pending;
          return (
            <li key={inspection.id ?? `${inspection.extinguisherId}-${inspection.assetId}`}>
              <button
                type="button"
                onClick={() => onInspect(inspection)}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left active:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {inspection.assetId || '—'}
                  </p>
                  <p className="truncate text-xs text-gray-600">
                    {vicinity || '—'}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">
                    Serial: {serial || '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.color}`}
                  >
                    {style.label}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isArchived ? 'text-gray-600' : 'text-red-600'
                    }`}
                  >
                    {isArchived ? 'View' : 'Inspect'}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
