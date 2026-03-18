/**
 * Reports page
 * Lists all archived workspace compliance reports with stats and download buttons.
 * Route: /dashboard/reports
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { subscribeToReports } from '../services/reportService.ts';
import { ReportDownloadButton } from '../components/reports/ReportDownloadButton.tsx';
import type { Report } from '../types/report.ts';

function formatTimestamp(timestamp: unknown): string {
  if (!timestamp) return '--';
  try {
    let date: Date;
    if (
      typeof timestamp === 'object' &&
      timestamp !== null &&
      'toDate' in timestamp &&
      typeof (timestamp as { toDate: () => Date }).toDate === 'function'
    ) {
      date = (timestamp as { toDate: () => Date }).toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '--';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
}

export default function Reports() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const unsub = subscribeToReports(orgId, (data) => {
      setReports(data);
      setLoading(false);
    });
    return () => unsub();
  }, [orgId]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Download inspection reports for archived workspaces. Reports are generated on demand.
        </p>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No reports yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Archive a workspace to generate your first compliance report.
          </p>
        </div>
      )}

      {/* Report list */}
      {!loading && reports.length > 0 && (
        <div className="space-y-4">
          {reports.map((report) => {
            const passRate =
              report.totalExtinguishers > 0
                ? Math.round((report.passedCount / report.totalExtinguishers) * 100)
                : 0;

            return (
              <div
                key={report.id}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                {/* Report header */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{report.label}</h2>
                    <p className="text-sm text-gray-500">
                      {report.monthYear} &middot; Archived {formatTimestamp(report.archivedAt)}
                    </p>
                  </div>
                  {/* Pass rate badge */}
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                      passRate >= 80
                        ? 'bg-green-100 text-green-700'
                        : passRate >= 50
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {passRate}% Pass Rate
                  </span>
                </div>

                {/* Stats row */}
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-gray-900">{report.totalExtinguishers}</p>
                  </div>
                  <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
                    <p className="text-xs text-green-600">Passed</p>
                    <p className="text-lg font-bold text-green-700">{report.passedCount}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
                    <p className="text-xs text-red-500">Failed</p>
                    <p className="text-lg font-bold text-red-700">{report.failedCount}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                    <p className="text-xs text-gray-500">Pending</p>
                    <p className="text-lg font-bold text-gray-600">{report.pendingCount}</p>
                  </div>
                </div>

                {/* Download buttons */}
                <div className="flex flex-wrap gap-2">
                  <span className="self-center text-xs text-gray-500 font-medium mr-1">Download:</span>
                  <ReportDownloadButton orgId={orgId} workspaceId={report.workspaceId} format="csv" />
                  <ReportDownloadButton orgId={orgId} workspaceId={report.workspaceId} format="pdf" />
                  <ReportDownloadButton orgId={orgId} workspaceId={report.workspaceId} format="json" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
