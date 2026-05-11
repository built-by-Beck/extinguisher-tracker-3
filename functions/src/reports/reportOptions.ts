export type ReportScope =
  | 'full'
  | 'failed_or_expired'
  | 'passed'
  | 'pending'
  | 'replacement_candidates';
export type ReportSortBy = 'location' | 'assetId';

export interface ReportGenerationOptions {
  scope: ReportScope;
  sortBy: ReportSortBy;
}

export interface ReportOptionRow {
  assetId: string;
  serial?: string;
  parentLocation?: string;
  locationName?: string;
  section?: string;
  vicinity?: string;
  status: string;
  manufactureYear?: number | null;
  isExpired?: boolean | null;
}

export interface ReportOptionStats {
  totalExtinguishers: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
}

export const DEFAULT_REPORT_OPTIONS: ReportGenerationOptions = {
  scope: 'full',
  sortBy: 'location',
};

const validScopes = new Set<ReportScope>([
  'full',
  'failed_or_expired',
  'passed',
  'pending',
  'replacement_candidates',
]);

const validSorts = new Set<ReportSortBy>(['location', 'assetId']);

const collator = new Intl.Collator('en-US', {
  numeric: true,
  sensitivity: 'base',
});

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeStatus(value: unknown): string {
  return stringOrEmpty(value).toLowerCase();
}

function isReplacementCandidate(
  row: ReportOptionRow,
  currentYear: number,
): boolean {
  return (
    row.isExpired !== true &&
    typeof row.manufactureYear === 'number' &&
    row.manufactureYear <= currentYear - 6
  );
}

function matchesScope(
  row: ReportOptionRow,
  scope: ReportScope,
  currentYear: number,
): boolean {
  const status = normalizeStatus(row.status);
  switch (scope) {
    case 'failed_or_expired':
      return status === 'fail' || row.isExpired === true;
    case 'passed':
      return status === 'pass';
    case 'pending':
      return status !== 'pass' && status !== 'fail';
    case 'replacement_candidates':
      return isReplacementCandidate(row, currentYear);
    case 'full':
      return true;
  }
}

function locationSortValue(row: ReportOptionRow): string {
  return [
    row.parentLocation,
    row.locationName,
    row.section,
    row.vicinity,
    row.assetId,
  ]
    .map(stringOrEmpty)
    .join(' ');
}

function compareRows(
  a: ReportOptionRow,
  b: ReportOptionRow,
  sortBy: ReportSortBy,
): number {
  if (sortBy === 'assetId') {
    return (
      collator.compare(a.assetId, b.assetId) ||
      collator.compare(locationSortValue(a), locationSortValue(b))
    );
  }

  return (
    collator.compare(locationSortValue(a), locationSortValue(b)) ||
    collator.compare(a.assetId, b.assetId)
  );
}

export function parseReportOptions(input: unknown): ReportGenerationOptions {
  const value = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
  const scope = validScopes.has(value.scope as ReportScope)
    ? (value.scope as ReportScope)
    : DEFAULT_REPORT_OPTIONS.scope;
  const sortBy = validSorts.has(value.sortBy as ReportSortBy)
    ? (value.sortBy as ReportSortBy)
    : DEFAULT_REPORT_OPTIONS.sortBy;

  return { scope, sortBy };
}

export function reportOptionsStorageSuffix(
  options: ReportGenerationOptions,
): string {
  return `${options.scope}-${options.sortBy}`;
}

export function calculateReportStats(
  rows: ReportOptionRow[],
): ReportOptionStats {
  let passedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;

  for (const row of rows) {
    const status = normalizeStatus(row.status);
    if (status === 'pass') passedCount++;
    else if (status === 'fail') failedCount++;
    else pendingCount++;
  }

  return {
    totalExtinguishers: rows.length,
    passedCount,
    failedCount,
    pendingCount,
  };
}

export function applyReportOptions<T extends ReportOptionRow>(
  rows: T[],
  options: ReportGenerationOptions,
  currentYear = new Date().getUTCFullYear(),
): { rows: T[]; stats: ReportOptionStats } {
  const filteredRows = rows
    .filter((row) => matchesScope(row, options.scope, currentYear))
    .sort((a, b) => compareRows(a, b, options.sortBy));

  return {
    rows: filteredRows,
    stats: calculateReportStats(filteredRows),
  };
}
