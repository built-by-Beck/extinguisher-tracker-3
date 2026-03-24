/**
 * ImportExportBar — grouped import/export actions with drag-and-drop.
 *
 * Author: built_by_Beck
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Upload, Download, Loader2, FileJson, X, FileSpreadsheet } from 'lucide-react';
import { read, utils } from 'xlsx';
import { functions } from '../../lib/firebase.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { ColumnMapperModal, TARGET_FIELDS } from './ColumnMapperModal.tsx';
import { getAllActiveExtinguishers } from '../../services/extinguisherService.ts';
import { subscribeToLocations, type Location } from '../../services/locationService.ts';

interface ImportExportBarProps {
  onImportJSON?: () => void;
  /** @deprecated No longer used — import available on all plans */
  plan?: string | null;
}

function rowsToCSV(rows: Record<string, string>[], headers?: string[]): string {
  if (rows.length === 0) return '';
  const cols = headers ?? Object.keys(rows[0]);
  const lines = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map((h) => {
      const val = row[h] ?? '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(','));
  }
  return lines.join('\n');
}

function parseCSVToRows(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseTXTToRows(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return parseCSVToRows(content);

  const firstLine = lines[0];
  let delimiter = '\t';
  if (!firstLine.includes('\t')) {
    if (firstLine.includes('|')) delimiter = '|';
    else if (firstLine.includes(';')) delimiter = ';';
    else return parseCSVToRows(content);
  }

  const headers = firstLine.split(delimiter).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseExcelToRows(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' });
}

function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [sourceCol, targetKey] of Object.entries(mapping)) {
      if (targetKey && row[sourceCol] !== undefined) {
        mapped[targetKey] = row[sourceCol];
      }
    }
    return mapped;
  });
}

function columnsMatchExpected(columns: string[]): boolean {
  const required = TARGET_FIELDS.filter((f) => f.required).map((f) => f.key);
  return required.every((key) => columns.includes(key));
}

const ACCEPTED_EXTENSIONS = '.csv,.xls,.xlsx,.json,.txt';

export function ImportExportBar({ onImportJSON }: ImportExportBarProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto-dismiss messages
  useEffect(() => {
    if (!importResult) return;
    const timer = setTimeout(() => setImportResult(null), 8000);
    return () => clearTimeout(timer);
  }, [importResult]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  // Locations for default assignment
  const [locations, setLocations] = useState<Location[]>([]);
  const [defaultImportLocId, setDefaultImportLocId] = useState('');

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  // Column mapper state
  const [showMapper, setShowMapper] = useState(false);
  const [parsedColumns, setParsedColumns] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);

  // Import is available on all plans

  async function processFile(file: File) {
    if (!orgId) return;
    setError('');
    setImportResult(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

      if (ext === 'json') {
        onImportJSON?.();
        return;
      }

      let rows: Record<string, string>[];

      if (ext === 'xls' || ext === 'xlsx') {
        const buffer = await file.arrayBuffer();
        rows = parseExcelToRows(buffer);
      } else if (ext === 'txt') {
        const text = await file.text();
        rows = parseTXTToRows(text);
      } else {
        const text = await file.text();
        rows = parseCSVToRows(text);
      }

      if (rows.length === 0) {
        setError('File contains no data rows. Check the file and try again.');
        return;
      }

      const columns = Object.keys(rows[0]);

      if (columnsMatchExpected(columns)) {
        await performImport(rows, columns);
      } else {
        setParsedColumns(columns);
        setParsedRows(rows);
        setShowMapper(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to read file.');
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const validExts = ['csv', 'xls', 'xlsx', 'json', 'txt'];
    if (!validExts.includes(ext)) {
      setError(`Unsupported file type: .${ext}. Use CSV, Excel, JSON, or TXT.`);
      return;
    }

    await processFile(file);
  }

  async function performImport(finalRows: Record<string, string>[], targetKeys: string[]) {
    if (defaultImportLocId) {
      const loc = locations.find((l) => l.id === defaultImportLocId);
      if (loc) {
        finalRows.forEach((row) => {
          row.parentLocation = loc.name;
          row.locationId = loc.id!;
        });
        if (!targetKeys.includes('parentLocation')) targetKeys.push('parentLocation');
        if (!targetKeys.includes('locationId')) targetKeys.push('locationId');
      }
    }
    const csvContent = rowsToCSV(finalRows, targetKeys);
    await doImport(csvContent);
  }

  async function handleMappingConfirmed(mapping: Record<string, string>) {
    setShowMapper(false);
    const remapped = applyMapping(parsedRows, mapping);
    const targetKeys = [...new Set(Object.values(mapping).filter(Boolean))];
    await performImport(remapped, targetKeys);
    setParsedColumns([]);
    setParsedRows([]);
  }

  async function doImport(csvContent: string) {
    setImporting(true);
    setError('');
    setImportResult(null);

    try {
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
    }
  }

  async function handleExportBackup() {
    if (!orgId) return;
    setExporting(true);
    setError('');
    try {
      const allExt = await getAllActiveExtinguishers(orgId);
      const backup = {
        exportedAt: new Date().toISOString(),
        orgId,
        version: '3.0',
        extinguishers: allExt,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ex3-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Backup export failed.');
    } finally {
      setExporting(false);
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
      window.open(result.data.downloadUrl, '_blank');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Feedback messages */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-3 text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {importResult && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
          <p className="text-sm text-green-700">{importResult}</p>
          <button onClick={() => setImportResult(null)} className="ml-3 text-green-400 hover:text-green-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Import section */}
        <div className="flex-1 rounded-lg border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Import</p>

          {/* Drag and drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`mb-3 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
              isDragOver
                ? 'border-red-400 bg-red-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
          >
            <FileSpreadsheet className={`mb-1.5 h-6 w-6 ${isDragOver ? 'text-red-400' : 'text-gray-400'}`} />
            <p className="text-xs text-gray-500">
              Drop CSV, Excel, or TXT file here
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={defaultImportLocId}
              onChange={(e) => { setDefaultImportLocId(e.target.value); setError(''); }}
              disabled={importing}
              className="h-9 max-w-[180px] rounded-md border-gray-300 py-0 pl-3 pr-8 text-sm focus:border-red-500 focus:ring-red-500"
            >
              <option value="">
                {locations.length === 0 ? '-- Add a location first --' : '-- Select Location --'}
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>

            <label className={`flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium ${
              !defaultImportLocId || locations.length === 0
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : 'cursor-pointer bg-white text-gray-700 hover:bg-gray-100'
            }`}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Browse
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileSelected}
                disabled={importing || !defaultImportLocId || locations.length === 0}
                className="hidden"
              />
            </label>

            {onImportJSON && (
              <button
                onClick={onImportJSON}
                disabled={importing}
                className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <FileJson className="h-4 w-4" />
                JSON Backup
              </button>
            )}
          </div>
        </div>

        {/* Export section */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Export</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </button>
            <button
              onClick={handleExportBackup}
              disabled={exporting}
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              JSON Backup
            </button>
          </div>
        </div>
      </div>

      {/* Column Mapper Modal */}
      <ColumnMapperModal
        open={showMapper}
        onClose={() => {
          setShowMapper(false);
          setParsedColumns([]);
          setParsedRows([]);
        }}
        sourceColumns={parsedColumns}
        previewRows={parsedRows}
        onConfirm={handleMappingConfirmed}
        autoMappedLocation={!!defaultImportLocId}
      />
    </div>
  );
}
