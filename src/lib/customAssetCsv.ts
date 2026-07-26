/**
 * Client-only CSV helpers for bulk-creating Custom Assets.
 *
 * Columns (header row required, case-insensitive):
 *   name          — required; asset display name
 *   assetType     — optional; free-text type (e.g. "Elevator")
 *   locationName  — optional; matched case-insensitively to org locations
 *   recurrence    — optional; defaults to "monthly"
 *   items         — optional; pipe-separated inspection column labels
 *   assetCode     — optional; identifier / code
 *
 * No Cloud Function is invoked. The caller resolves locationName → id after
 * parsing using resolveLocationIds().
 */

import type { Location } from '../services/locationService.ts';
import { createInspectionItem } from '../services/assetService.ts';
import type {
  CreateAssetInput,
  CustomAssetRecurrence,
} from '../services/assetService.ts';

export interface CsvRow {
  name: string;
  assetType: string;
  locationName: string;
  recurrence: CustomAssetRecurrence;
  items: string[];
  assetCode: string;
}

export interface CsvParseResult {
  rows: CsvRow[];
  errors: string[];
}

const VALID_RECURRENCES = new Set<string>([
  'monthly',
  'weekly',
  'quarterly',
  'annual',
  'custom',
]);

const REQUIRED_HEADERS = ['name'];
const KNOWN_HEADERS = [
  'name',
  'assettype',
  'locationname',
  'recurrence',
  'items',
  'assetcode',
];

/**
 * Parse a CSV string (with header row) into CsvRow[].
 *
 * Supports quoted fields with embedded commas and newlines.
 * Lines that are entirely blank after trimming are skipped.
 */
export function parseCsvText(text: string): CsvParseResult {
  const errors: string[] = [];
  const rows: CsvRow[] = [];

  const lines = splitCsvLines(text.trim());
  if (lines.length === 0) {
    errors.push('CSV is empty.');
    return { rows, errors };
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());

  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      errors.push(`Missing required column: "${required}".`);
    }
  }
  if (errors.length > 0) return { rows, errors };

  const unknownHeaders = headers.filter(
    (h) => !KNOWN_HEADERS.includes(h) && h !== '',
  );
  if (unknownHeaders.length > 0) {
    errors.push(
      `Unknown column(s): ${unknownHeaders.map((h) => `"${h}"`).join(', ')}. Expected: name, assetType, locationName, recurrence, items, assetCode.`,
    );
    return { rows, errors };
  }

  const idx = (col: string) => headers.indexOf(col);

  for (let lineNum = 1; lineNum < lines.length; lineNum++) {
    const rawLine = lines[lineNum];
    if (!rawLine.trim()) continue;

    const cells = parseCsvLine(rawLine);
    const get = (col: string): string => (cells[idx(col)] ?? '').trim();

    const name = get('name');
    if (!name) {
      errors.push(`Row ${lineNum + 1}: "name" is required but was empty.`);
      continue;
    }

    const recurrenceRaw = get('recurrence').toLowerCase() || 'monthly';
    if (!VALID_RECURRENCES.has(recurrenceRaw)) {
      errors.push(
        `Row ${lineNum + 1}: invalid recurrence "${recurrenceRaw}". Must be one of: monthly, weekly, quarterly, annual, custom.`,
      );
      continue;
    }

    const itemsRaw = get('items');
    const items = itemsRaw
      ? itemsRaw
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    rows.push({
      name,
      assetType: get('assettype'),
      locationName: get('locationname'),
      recurrence: recurrenceRaw as CustomAssetRecurrence,
      items,
      assetCode: get('assetcode'),
    });
  }

  return { rows, errors };
}

/**
 * Resolve locationName values in parsed rows to locationId using the org's
 * location list (case-insensitive name match on non-deleted locations).
 * Returns the same rows enriched with a `locationId` field.
 */
export function resolveLocationIds(
  rows: CsvRow[],
  locations: Location[],
): Array<CsvRow & { locationId: string | null }> {
  const nameMap = new Map<string, string>();
  for (const loc of locations) {
    if (!loc.deletedAt && loc.id) {
      nameMap.set(loc.name.trim().toLowerCase(), loc.id);
    }
  }

  return rows.map((row) => ({
    ...row,
    locationId: row.locationName
      ? (nameMap.get(row.locationName.toLowerCase()) ?? null)
      : null,
  }));
}

/**
 * Convert a resolved CsvRow into a CreateAssetInput suitable for createAsset().
 */
export function csvRowToCreateInput(
  row: CsvRow & { locationId: string | null },
): CreateAssetInput {
  return {
    name: row.name,
    assetType: row.assetType || undefined,
    assetCode: row.assetCode || undefined,
    locationId: row.locationId,
    locationName: row.locationName || undefined,
    recurrence: row.recurrence,
    templateId: null,
    inspectionItems: row.items.map((label, order) =>
      createInspectionItem(label, order),
    ),
  };
}

/**
 * Split a multi-line CSV string into individual record lines.
 * Handles quoted fields that contain newlines.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if (ch === '\r') {
      // skip \r
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}
