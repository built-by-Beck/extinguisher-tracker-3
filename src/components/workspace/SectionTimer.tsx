import { Play, Pause, StopCircle, Timer } from 'lucide-react';
import { formatWorkTimeHours } from '../../utils/workTimeUtils.ts';

interface SectionTimerProps {
  section: string;
  isActive: boolean;
  todayMs: number;
  totalMs: number;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  disabled?: boolean;
  formatTime: (ms: number) => string;
}

export function SectionTimer({
  section,
  isActive,
  todayMs,
  totalMs,
  onStart,
  onPause,
  onStop,
  disabled = false,
  formatTime,
}: SectionTimerProps) {
  const liveDisplay = isActive ? totalMs : totalMs;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Timer
            className={`h-5 w-5 shrink-0 ${isActive ? 'animate-pulse text-red-600' : 'text-gray-400'}`}
          />
          <div className="min-w-0">
            <p
              className={`text-lg font-bold tabular-nums ${isActive ? 'text-red-600' : liveDisplay > 0 ? 'text-gray-900' : 'text-gray-400'}`}
            >
              {formatTime(liveDisplay)}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
              <span>Today: {formatWorkTimeHours(todayMs)}</span>
              <span>Total: {formatWorkTimeHours(totalMs)}</span>
            </div>
          </div>
        </div>

        {!disabled && (
          <div className="flex shrink-0 items-center gap-2">
            {isActive ? (
              <>
                <button
                  type="button"
                  onClick={onPause}
                  aria-label={`Pause timer for ${section}`}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
                  title="Pause timer"
                >
                  <Pause className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onStop}
                  aria-label={`Stop timer for ${section}`}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                  title="Stop timer"
                >
                  <StopCircle className="h-5 w-5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStart}
                aria-label={`Start timer for ${section}`}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                title="Start timer"
              >
                <Play className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
