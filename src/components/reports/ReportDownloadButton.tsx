/**
 * ReportDownloadButton — triggers on-demand report generation and downloads the file.
 * Shows a loading spinner while the Cloud Function is executing, then opens the URL in a new tab.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, FileJson, Loader2 } from 'lucide-react';
import { generateReportDownload } from '../../services/reportService.ts';
import type { ReportFormat } from '../../types/report.ts';

interface ReportDownloadButtonProps {
  orgId: string;
  workspaceId: string;
  format: ReportFormat;
  label?: string;
}

const FORMAT_ICON: Record<ReportFormat, typeof FileText> = {
  csv: FileSpreadsheet,
  pdf: FileText,
  json: FileJson,
};

const FORMAT_LABEL: Record<ReportFormat, string> = {
  csv: 'CSV',
  pdf: 'PDF',
  json: 'JSON',
};

export function ReportDownloadButton({
  orgId,
  workspaceId,
  format,
  label,
}: ReportDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const Icon = FORMAT_ICON[format];
  const displayLabel = label ?? FORMAT_LABEL[format];

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { downloadUrl } = await generateReportDownload(orgId, workspaceId, format);
      window.open(downloadUrl, '_blank');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate report.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {displayLabel}
      </button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
