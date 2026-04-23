/**
 * Clickable stat cards for workspace inspection scope (checked / pass / fail / replaced).
 *
 * Author: built_by_Beck
 */

import type { LucideIcon } from 'lucide-react';
import { ListChecks, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import type { WorkspaceInspectionBucketStats } from '../../utils/workspaceInspectionStats.ts';

export type WorkspaceScopeCardFilter = 'pending' | 'checked' | 'pass' | 'fail' | 'replaced';

interface WorkspaceInspectionScopeCardsProps {
  stats: WorkspaceInspectionBucketStats;
  replacedTotal?: number;
  /** Highlight when this filter is active (non-leaf list or leaf filter mode). */
  activeFilter?: WorkspaceScopeCardFilter | null;
  onSelectFilter: (filter: WorkspaceScopeCardFilter | null) => void;
  className?: string;
}

function Card({
  label,
  value,
  icon: Icon,
  color,
  selected,
  onClick,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow sm:p-5 ${
        selected
          ? 'border-red-500 ring-2 ring-red-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{value}</p>
        </div>
        <div className={`shrink-0 rounded-lg p-2.5 sm:p-3 ${color}`}>
          <Icon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
        </div>
      </div>
    </button>
  );
}

export function WorkspaceInspectionScopeCards({
  stats,
  replacedTotal,
  activeFilter,
  onSelectFilter,
  className = '',
}: WorkspaceInspectionScopeCardsProps) {
  const checked = stats.passed + stats.failed + Math.max(0, stats.replaced ?? 0);

  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`}>
      <Card
        label="Already checked"
        value={String(Math.max(0, checked))}
        icon={ListChecks}
        color="bg-slate-600"
        selected={activeFilter === 'checked'}
        onClick={() => onSelectFilter(activeFilter === 'checked' ? null : 'checked')}
      />
      <Card
        label="Passed"
        value={String(Math.max(0, stats.passed))}
        icon={CheckCircle2}
        color="bg-green-500"
        selected={activeFilter === 'pass'}
        onClick={() => onSelectFilter(activeFilter === 'pass' ? null : 'pass')}
      />
      <Card
        label="Failed"
        value={String(Math.max(0, stats.failed))}
        icon={XCircle}
        color="bg-red-600"
        selected={activeFilter === 'fail'}
        onClick={() => onSelectFilter(activeFilter === 'fail' ? null : 'fail')}
      />
      <Card
        label="Replaced"
        value={String(Math.max(0, replacedTotal ?? stats.replaced ?? 0))}
        icon={RefreshCw}
        color="bg-orange-500"
        selected={activeFilter === 'replaced'}
        onClick={() => onSelectFilter(activeFilter === 'replaced' ? null : 'replaced')}
      />
    </div>
  );
}
