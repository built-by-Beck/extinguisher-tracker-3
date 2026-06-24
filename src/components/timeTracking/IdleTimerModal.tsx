interface IdleTimerModalProps {
  section: string;
  onResume: () => void;
  onDone: () => void;
}

export function IdleTimerModal({
  section,
  onResume,
  onDone,
}: IdleTimerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <span className="text-lg">⏱</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Timer paused — idle
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Your timer in{' '}
              <span className="font-medium text-gray-800">{section}</span> was
              paused after 30 minutes of inactivity. Time up to 30 minutes was
              saved.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
