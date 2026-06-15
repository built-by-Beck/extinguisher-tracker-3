/**
 * InspectionRowCard — large, touch-friendly row for a single inspection.
 *
 * Designed for a field technician walking the floor: big tap target, clear
 * asset ID, vicinity, serial, and status chip. Used in the workspace
 * inspection lists (pending / checked / replaced) and scoped lists.
 *
 * Author: built_by_Beck
 */

import { CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import type { Inspection } from '../../services/inspectionService.ts';

/** Shared status visuals so every workspace list renders consistently. */
export const STATUS_STYLES: Record<
  string,
  { icon: typeof CheckCircle2; color: string; bg: string; label: string }
> = {
  pass: {
    icon: CheckCircle2,
    color: 'text-green-700',
    bg: 'bg-green-100',
    label: 'Passed',
  },
  fail: {
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-100',
    label: 'Failed',
  },
  pending: {
    icon: Clock,
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    label: 'Pending',
  },
  replaced: {
    icon: RefreshCw,
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    label: 'Replaced',
  },
};

interface InspectionRowCardProps {
  inspection: Inspection;
  vicinity: string;
  onClick: () => void;
  /** Right-side call to action, e.g. "Inspect" or "View". */
  actionLabel: string;
  /** Dim the action (archived/read-only contexts). */
  actionMuted?: boolean;
}

export function InspectionRowCard({
  inspection,
  vicinity,
  onClick,
  actionLabel,
  actionMuted = false,
}: InspectionRowCardProps) {
  const style = STATUS_STYLES[inspection.status] ?? STATUS_STYLES.pending;
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm transition active:scale-[0.99] hover:border-gray-300 hover:shadow-md sm:py-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-gray-900 sm:text-base">
            {inspection.assetId}
          </p>
          <p className="truncate text-sm text-gray-600">{vicinity || '--'}</p>
          <p className="truncate text-xs text-gray-500">
            Serial: {inspection.serial || '--'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.color}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {style.label}
          </span>
          <span
            className={`text-xs font-semibold ${
              actionMuted ? 'text-gray-500' : 'text-red-600'
            }`}
          >
            {actionLabel}
          </span>
        </div>
      </div>
      {(inspection.inspectedByEmail || inspection.notes) && (
        <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
          {inspection.inspectedByEmail && (
            <p className="truncate">
              Inspected by: {inspection.inspectedByEmail}
            </p>
          )}
          {inspection.notes && (
            <p className="truncate italic">Notes: {inspection.notes}</p>
          )}
        </div>
      )}
    </button>
  );
}
