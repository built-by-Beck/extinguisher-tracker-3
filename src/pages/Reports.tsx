/**
 * Reports page
 * Lists all archived workspace compliance reports with stats and download buttons.
 * Route: /dashboard/reports
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { FileText, Loader2, Download } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { subscribeToReports, generateReportDownload } from '../services/reportService.ts';
import { ReportDownloadButton } from '../components/reports/ReportDownloadButton.tsx';
import type { Report, ReportFormat } from '../types/report.ts';

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

  const [genWorkspaceId, setGenWorkspaceId] = useState('');
  const [genFormat, setGenFormat] = useState<ReportFormat>('pdf');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const unsub = subscribeToReports(orgId, (data) => {
      setReports(data);
      if (data.length > 0 && !genWorkspaceId) {
        setGenWorkspaceId(data[0].workspaceId);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [orgId, genWorkspaceId]);

  async function handleGenerate() {
    if (!orgId || !genWorkspaceId) return;
    setGenerating(true);
    setGenError('');
    try {
      const { downloadUrl } = await generateReportDownload(orgId, genWorkspaceId, genFormat);
      window.open(downloadUrl, '_blank');
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Download inspection reports for archived workspaces. Reports are generated on demand.
        </p>
      </div>

      {/* Page description */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <p>
          Compliance reports are generated from archived workspaces. Each report includes
          pass/fail counts, inspector details, and a full breakdown by location — ready to
          hand to a fire marshal or keep on file for your records.
        </p>
      </div>

      {/* Generate Report Card */}
      {!loading && reports.length > 0 && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Generate Report</h2>
          {genError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {genError}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-sm font-medium text-gray-700">Select Workspace</label>
              <select
                value={genWorkspaceId}
                onChange={(e) => setGenWorkspaceId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                disabled={generating}
              >
                {reports.map((r) => (
                  <option key={r.workspaceId} value={r.workspaceId}>
                    {r.label} ({r.monthYear})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="mb-1 block text-sm font-medium text-gray-700">Format</label>
              <select
                value={genFormat}
                onChange={(e) => setGenFormat(e.target.value as ReportFormat)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                disabled={generating}
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !genWorkspaceId}
              className="flex h-[38px] items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Generate
            </button>
          </div>
        </div>
      )}

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
