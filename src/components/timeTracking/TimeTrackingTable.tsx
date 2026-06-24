import { Play, StopCircle } from 'lucide-react';
import { formatWorkTimeHours } from '../../utils/workTimeUtils.ts';
import type { AggregatedWorkTimeRow } from '../../services/workTimeService.ts';

interface TimeTrackingTableProps {
  rows: AggregatedWorkTimeRow[];
  groupByMember: boolean;
  activeSection: string | null;
  activeUserId: string | null;
  currentUserId: string;
  onStart: (section: string) => void;
  onStop: () => void;
  canControlRow: (row: AggregatedWorkTimeRow) => boolean;
}

export function TimeTrackingTable({
  rows,
  groupByMember,
  activeSection,
  activeUserId,
  currentUserId,
  onStart,
  onStop,
  canControlRow,
}: TimeTrackingTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
        <p className="text-sm text-gray-500">
          No time logged yet for this workspace. Start a timer while inspecting
          a section, or press Start on a row below once sections appear.
        </p>
      </div>
    );
  }

  const grouped = groupByMember
    ? rows.reduce<Record<string, AggregatedWorkTimeRow[]>>((acc, row) => {
        const key = row.userEmail || row.userId;
        acc[key] = acc[key] ?? [];
        acc[key].push(row);
        return acc;
      }, {})
    : { All: rows };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([groupLabel, groupRows]) => (
        <div key={groupLabel}>
          {groupByMember && (
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              {groupLabel}
            </h3>
          )}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {!groupByMember && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Member
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Location / Section
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Today
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Workspace Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupRows.map((row) => {
                  const isRunning =
                    activeSection === row.section &&
                    activeUserId === row.userId &&
                    row.userId === currentUserId;
                  const canControl = canControlRow(row);

                  return (
                    <tr key={`${row.userId}-${row.section}`}>
                      {!groupByMember && (
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {row.userEmail || row.userId}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {row.section}
                        {isRunning && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Running
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                        {formatWorkTimeHours(row.todayMs)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                        {formatWorkTimeHours(row.totalMs)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canControl &&
                          (isRunning ? (
                            <button
                              type="button"
                              onClick={onStop}
                              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                            >
                              <StopCircle className="h-3.5 w-3.5" />
                              Stop
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onStart(row.section)}
                              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Start
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
