/**
 * LocationCard — card for drill-down location navigation.
 * Shows location name, type, extinguisher count, progress, and pass/fail/pending stats.
 *
 * Author: built_by_Beck
 */

import { MapPin, Building2, Layers, CheckCircle2, XCircle, Clock, Flame, RefreshCw } from 'lucide-react';
import { getLocationTypeLabel } from '../../services/locationService.ts';

export interface LocationCardStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  replaced?: number;
  percentage: number;
}

interface LocationCardProps {
  name: string;
  locationType?: string;
  stats: LocationCardStats;
  onClick: () => void;
}

const TYPE_ICONS: Record<string, typeof Building2> = {
  campus: Building2,
  building: Building2,
  floor: Layers,
};

export function LocationCard({ name, locationType, stats, onClick }: LocationCardProps) {
  const Icon = (locationType && TYPE_ICONS[locationType]) || MapPin;

  const completionColor =
    stats.percentage === 100
      ? 'text-green-600'
      : stats.percentage >= 50
        ? 'text-yellow-600'
        : stats.percentage > 0
          ? 'text-orange-600'
          : 'text-gray-400';

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-red-300 hover:shadow-md"
    >
      {/* Header: Icon + Name + Type Badge */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-gray-900 group-hover:text-red-600">{name}</h3>
        </div>
        {locationType && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {getLocationTypeLabel(locationType)}
          </span>
        )}
      </div>

      {/* Count + Percentage */}
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-1">
          <Flame className="h-4 w-4 text-gray-400" />
          <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
          <span className="text-xs text-gray-500">extinguishers</span>
        </div>
        <span className={`text-lg font-bold ${completionColor}`}>{stats.percentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-100">
        {stats.total > 0 && (
          <div className="flex h-2 overflow-hidden rounded-full">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(stats.passed / stats.total) * 100}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(stats.failed / stats.total) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Mini stats */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {stats.passed}
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="h-3 w-3 text-red-500" />
          {stats.failed}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-gray-400" />
          {stats.pending}
        </span>
        {(stats.replaced ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 text-orange-500" />
            {stats.replaced}
          </span>
        )}
      </div>
    </button>
  );
}
