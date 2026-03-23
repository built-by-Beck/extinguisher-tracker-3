import { Play, Pause, StopCircle, Timer } from 'lucide-react';

interface SectionTimerProps {
  section: string;
  activeSection: string | null;
  totalTime: number;
  onStart: (section: string) => void;
  onPause: () => void;
  onStop: () => void;
  disabled?: boolean;
  formatTime: (ms: number) => string;
}

export function SectionTimer({
  section,
  activeSection,
  totalTime,
  onStart,
  onPause,
  onStop,
  disabled = false,
  formatTime,
}: SectionTimerProps) {
  const isActive = activeSection === section;
  const displayTime = formatTime(totalTime);

  // Compute minutes for subtitle
  const totalMinutes = Math.floor(totalTime / 60000);
  const minuteLabel = totalMinutes === 1 ? 'minute' : 'minutes';

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Left side: timer display */}
        <div className="flex items-center gap-3">
          <Timer className={`h-5 w-5 ${isActive ? 'text-red-600 animate-pulse' : 'text-gray-400'}`} />
          <div>
            <p className={`text-lg font-bold ${isActive ? 'text-red-600' : totalTime > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
              {displayTime}
            </p>
            {totalTime > 0 && (
              <p className="text-xs text-gray-500">
                {totalMinutes} {minuteLabel} in this section
              </p>
            )}
          </div>
        </div>

        {/* Right side: controls */}
        {!disabled && (
          <div className="flex items-center gap-2">
            {isActive ? (
              <button
                onClick={() => onPause()}
                className="rounded-full bg-amber-100 p-2 text-amber-600 transition-colors hover:bg-amber-200"
                title="Pause timer"
              >
                <Pause className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => onStart(section)}
                className="rounded-full bg-green-100 p-2 text-green-600 transition-colors hover:bg-green-200"
                title="Start timer"
              >
                <Play className="h-5 w-5" />
              </button>
            )}
            {(isActive || totalTime > 0) && (
              <button
                onClick={() => onStop()}
                className="rounded-full bg-red-100 p-2 text-red-600 transition-colors hover:bg-red-200"
                title="Stop timer"
              >
                <StopCircle className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
