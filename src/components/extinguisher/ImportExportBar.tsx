import { useState, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Upload, Download, Loader2, FileJson } from 'lucide-react';
import { Workbook } from 'exceljs';
import { functions } from '../../lib/firebase.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { ColumnMapperModal, TARGET_FIELDS } from './ColumnMapperModal.tsx';
import { getAllActiveExtinguishers } from '../../services/extinguisherService.ts';
import { subscribeToLocations, type Location } from '../../services/locationService.ts';
import { useEffect } from 'react';

interface ImportExportBarProps {
  onImportJSON?: () => void;
  /** Current org plan — bulk import gated to elite/enterprise */
  plan?: string | null;
}

/**
 * Convert parsed rows (array of objects) to a CSV string.
 */
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

/**
 * Parse a raw CSV string into rows.
 */
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

/**
 * Parse a .txt file (tab, pipe, or semicolon delimited) into rows.
 */
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

/**
 * Parse an Excel file into rows from the first sheet.
 */
async function parseExcelToRows(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: Record<string, string>[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    // exceljs row.values is a 1-indexed sparse array; index 0 is always undefined,
    // so we slice off the leading empty slot before mapping header names.
    const values = (row.values as (string | number | boolean | null | undefined)[]).slice(1);
    if (rowNumber === 1) {
      headers = values.map((v) => String(v ?? '').trim());
    } else {
      const rowObj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        // Prefer cell.text (the formatted display value, e.g. "01/15/2025" for a date cell)
        // over cell.value (the raw underlying value, e.g. a Date object or serial number),
        // so imported data matches what the user sees in the spreadsheet.
        rowObj[header] = cell.text !== undefined ? String(cell.text) : String(cell.value ?? '');
      });
      rows.push(rowObj);
    }
  });

  return rows;
}

/**
 * Apply a column mapping to remap source rows to target field names.
 */
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

/**
 * Check if the parsed columns already match expected field names exactly.
 */
function columnsMatchExpected(columns: string[]): boolean {
  const required = TARGET_FIELDS.filter((f) => f.required).map((f) => f.key);
  return required.every((key) => columns.includes(key));
}

const ACCEPTED_EXTENSIONS = '.csv,.xls,.xlsx,.json,.txt';

export function ImportExportBar({ onImportJSON, plan }: ImportExportBarProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const canBulkImport = plan === 'elite' || plan === 'enterprise';

  /** Parse file into rows, then either import directly or show the mapper */
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    setError('');
    setImportResult(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

      // JSON files use the dedicated JSON import modal
      if (ext === 'json') {
        if (fileInputRef.current) fileInputRef.current.value = '';
        onImportJSON?.();
        return;
      }

      let rows: Record<string, string>[];

      if (ext === 'xls' || ext === 'xlsx') {
        const buffer = await file.arrayBuffer();
        rows = await parseExcelToRows(buffer);
      } else if (ext === 'txt') {
        const text = await file.text();
        rows = parseTXTToRows(text);
      } else {
        const text = await file.text();
        rows = parseCSVToRows(text);
      }

      if (rows.length === 0) {
        setError('File contains no data rows. Check the file and try again.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const columns = Object.keys(rows[0]);

      // If a default location was selected, inject it into every row
      if (defaultImportLocId) {
        const loc = locations.find((l) => l.id === defaultImportLocId);
        if (loc) {
          rows.forEach((row) => {
            row.parentLocation = loc.name;
            row.locationId = loc.id!;
          });
          if (!columns.includes('parentLocation')) columns.push('parentLocation');
          if (!columns.includes('locationId')) columns.push('locationId');
        }
      }

      // If columns already match, import directly
      if (columnsMatchExpected(columns)) {
        await doImport(rowsToCSV(rows));
      } else {
        // Show column mapper
        setParsedColumns(columns);
        setParsedRows(rows);
        setShowMapper(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to read file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /** Called when user confirms their column mapping */
  async function handleMappingConfirmed(mapping: Record<string, string>) {
    setShowMapper(false);
    const remapped = applyMapping(parsedRows, mapping);
    const targetKeys = [...new Set(Object.values(mapping).filter(Boolean))];
    await doImport(rowsToCSV(remapped, targetKeys));
    setParsedColumns([]);
    setParsedRows([]);
  }

  /** Send CSV to the Cloud Function */
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
    <div>
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {importResult && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{importResult}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Bulk Import — Elite and Enterprise only */}
        {canBulkImport && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1.5 shadow-sm">
            <select
              value={defaultImportLocId}
              onChange={(e) => setDefaultImportLocId(e.target.value)}
              disabled={importing}
              className="h-9 max-w-[200px] rounded-md border-gray-300 py-0 pl-3 pr-8 text-sm focus:border-red-500 focus:ring-red-500"
            >
              <option value="">-- Auto-map Location --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md bg-white border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileSelected}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Import JSON Backup — Elite and Enterprise only */}
        {canBulkImport && onImportJSON && (
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

        {/* Export Backup */}
        <button
          onClick={handleExportBackup}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Backup
        </button>
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
      />
    </div>
  );
}
