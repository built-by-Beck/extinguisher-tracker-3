import { useNavigate } from 'react-router-dom';
import { Clock, StopCircle } from 'lucide-react';
import { useSectionTimerContext } from '../../contexts/SectionTimerContext.tsx';

export function GlobalTimerBar() {
  const navigate = useNavigate();
  const {
    activeSection,
    activeWorkspaceLabel,
    currentElapsed,
    formatTime,
    stopTimer,
  } = useSectionTimerContext();

  if (!activeSection) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2">
      <button
        type="button"
        onClick={() => navigate('/dashboard/time-tracking')}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Clock className="h-4 w-4 shrink-0 animate-pulse text-red-600" />
        <span className="truncate text-sm font-medium text-red-900">
          {activeSection}
          {activeWorkspaceLabel ? ` · ${activeWorkspaceLabel}` : ''}
        </span>
        <span className="font-mono text-sm tabular-nums text-red-700">
          {formatTime(currentElapsed)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => stopTimer()}
        aria-label="Stop timer"
        className="flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
      >
        <StopCircle className="h-3.5 w-3.5" />
        Stop
      </button>
    </div>
  );
}
