import { useState, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Upload, Download, Loader2, FileJson } from 'lucide-react';
import { read, utils } from 'xlsx';
import { functions } from '../../lib/firebase.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { ColumnMapperModal, TARGET_FIELDS } from './ColumnMapperModal.tsx';

interface ImportExportBarProps {
  onImportJSON?: () => void;
  /** Current org plan — bulk import gated to elite/enterprise */
  plan?: string | null;
}

/** The column names the backend expects */
const EXPECTED_COLUMNS = new Set(TARGET_FIELDS.map((f) => f.key));

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
function parseExcelToRows(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' });
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
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const columns = Object.keys(rows[0]);

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
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import File
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileSelected}
              disabled={importing}
              className="hidden"
            />
          </label>
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
