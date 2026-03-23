import { useState, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Upload, Download, Loader2, FileJson } from 'lucide-react';
import { functions } from '../../lib/firebase.ts';
import { useAuth } from '../../hooks/useAuth.ts';

interface ImportExportBarProps {
  onImportJSON?: () => void;
}

export function ImportExportBar({ onImportJSON }: ImportExportBarProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    setImporting(true);
    setError('');
    setImportResult(null);

    try {
      const csvContent = await file.text();

      const importFn = httpsCallable<
        { orgId: string; csvContent: string },
        { totalRows: number; created: number; skipped: number; errors: string[] }
      >(functions, 'importExtinguishersCSV');

      const result = await importFn({ orgId, csvContent });
      const { created, skipped, errors } = result.data;

      let msg = `Imported ${created} extinguisher${created !== 1 ? 's' : ''}.`;
      if (skipped > 0) msg += ` ${skipped} skipped.`;
      if (errors.length > 0) msg += ` Issues: ${errors.slice(0, 3).join('; ')}`;

      setImportResult(msg);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleExport() {
    if (!orgId) return;
    setExporting(true);
    setError('');

    try {
      const exportFn = httpsCallable<
        { orgId: string },
        { downloadUrl: string; rowCount: number }
      >(functions, 'exportExtinguishersCSV');

      const result = await exportFn({ orgId });

      // Open download URL in new tab
      window.open(result.data.downloadUrl, '_blank');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {importResult && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{importResult}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Import CSV */}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import CSV
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
        </label>

        {/* Import JSON */}
        {onImportJSON && (
          <button
            onClick={onImportJSON}
            disabled={importing}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <FileJson className="h-4 w-4" />
            Import JSON Backup
          </button>
        )}

        {/* Export CSV */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </button>
      </div>
    </div>
  );
}
