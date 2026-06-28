import {
  collection,
  doc,
  addDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  type DocumentSnapshot,
  type QueryConstraint,
  type QuerySnapshot,
  getCountFromServer,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';

/** Dev server, or set localStorage EX3_DEBUG_SEARCH=1 and reload for production traces. */
function isExSearchDebugEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('EX3_DEBUG_SEARCH') === '1';
  } catch {
    return false;
  }
}

const EXTINGUISHER_LOOKUP_FIELDS = [
  'barcode',
  'assetId',
  'serial',
  'qrCodeValue',
] as const;

type ExtinguisherLookupField = (typeof EXTINGUISHER_LOOKUP_FIELDS)[number];
type LookupQueryType = 'strict-active' | 'legacy-deletedAt-only';

/** Max docs read per field on identifier equality lookups (exact barcode/serial/asset/QR). */
const IDENTIFIER_LOOKUP_PER_FIELD_LIMIT = 8;

const LOOKUP_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const LOOKUP_SESSION_CACHE_MAX = 200;
const lookupSessionCache = new Map<
  string,
  { at: number; value: Extinguisher | null }
>();

function lookupSessionCacheKey(orgId: string, code: string): string {
  return `${orgId}::${code}`;
}

function readLookupSessionCache(
  orgId: string,
  code: string,
): Extinguisher | null | undefined {
  const entry = lookupSessionCache.get(lookupSessionCacheKey(orgId, code));
  if (!entry) return undefined;
  if (Date.now() - entry.at > LOOKUP_SESSION_CACHE_TTL_MS) {
    lookupSessionCache.delete(lookupSessionCacheKey(orgId, code));
    return undefined;
  }
  return entry.value;
}

function writeLookupSessionCache(
  orgId: string,
  code: string,
  value: Extinguisher | null,
): void {
  if (lookupSessionCache.size >= LOOKUP_SESSION_CACHE_MAX) {
    const oldest = lookupSessionCache.keys().next().value;
    if (oldest) lookupSessionCache.delete(oldest);
  }
  lookupSessionCache.set(lookupSessionCacheKey(orgId, code), {
    at: Date.now(),
    value,
  });
}

function totalDocsInSnaps(snaps: QuerySnapshot[]): number {
  return snaps.reduce((n, s) => n + s.size, 0);
}

/**
 * Shared identifier lookup for scan + type paths. One strict wave (4 parallel queries),
 * legacy wave only when strict returns zero docs (legacy rows missing lifecycleStatus).
 */
async function lookupActiveExtinguisherByIdentifier(
  orgId: string,
  rawCode: string,
  maxResults: number,
  options: { useSessionCache?: boolean } = {},
): Promise<Extinguisher[]> {
  const code = rawCode.trim();
  if (!code) return [];

  if (options.useSessionCache && maxResults === 1) {
    const cached = readLookupSessionCache(orgId, code);
    if (cached !== undefined) {
      exSearchLog('session lookup cache hit', { searchInput: code, found: !!cached });
      return cached ? [cached] : [];
    }
  }

  const strictWave = await runStrictLookupWave(
    orgId,
    code,
    IDENTIFIER_LOOKUP_PER_FIELD_LIMIT,
  );
  let out = collectActiveMatchesFromOrderedSnaps(strictWave.snaps, maxResults);

  if (out.length === 0 && totalDocsInSnaps(strictWave.snaps) === 0) {
    exSearchLog(
      'Strict lookup returned no docs; trying legacy wave (rows may lack lifecycleStatus)',
      { searchInput: code },
    );
    const legacyWave = await runLegacyLookupWave(
      orgId,
      code,
      IDENTIFIER_LOOKUP_PER_FIELD_LIMIT,
    );
    out = collectActiveMatchesFromOrderedSnaps(legacyWave.snaps, maxResults);
  }

  if (options.useSessionCache && maxResults === 1) {
    writeLookupSessionCache(orgId, code, out[0] ?? null);
  }

  return out.slice(0, maxResults);
}

export interface ExtinguisherLookupQueryDiagnostic {
  field: ExtinguisherLookupField;
  queryType: LookupQueryType;
  durationMs: number;
  fromCache: boolean;
  docCount: number;
  docIds: string[];
  filters: string[];
  limit: number;
}

export interface ExtinguisherSearchDiagnosticReport {
  searchInput: string;
  orgId: string;
  clientLookups: ExtinguisherLookupQueryDiagnostic[];
  summary: {
    totalDurationMs: number;
    slowestQueryMs: number;
    allFromCache: boolean;
    anyNetworkFetch: boolean;
    likelyBottleneck:
      | 'local-cache'
      | 'network-latency'
      | 'firestore-server'
      | 'mixed';
    interpretation: string;
  };
  serverExplain?: unknown;
}

function exSearchLog(message: string, detail?: Record<string, unknown>): void {
  if (!isExSearchDebugEnabled()) return;
  if (detail) console.info(`[EX3 extinguisher search] ${message}`, detail);
  else console.info(`[EX3 extinguisher search] ${message}`);
}

function exSearchWarn(message: string, detail?: Record<string, unknown>): void {
  if (!isExSearchDebugEnabled()) return;
  if (detail) console.warn(`[EX3 extinguisher search] ${message}`, detail);
  else console.warn(`[EX3 extinguisher search] ${message}`);
}

function collectionPathExtinguishers(orgId: string): string {
  return `org/${orgId}/extinguishers`;
}

/**
 * True when the box should use exact Firestore identifier queries instead of
 * scanning the full local snapshot (substring / location-name search stays client-side).
 */
export function isLikelyFirestoreIdentifierQuery(raw: string): boolean {
  const q = raw.trim();
  if (q.length < 5) return false;
  if (/\s/.test(q)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9\-_.:/#]*$/.test(q);
}

function summarizeLookupDiagnostics(
  lookups: ExtinguisherLookupQueryDiagnostic[],
): ExtinguisherSearchDiagnosticReport['summary'] {
  const totalDurationMs = lookups.reduce((n, q) => n + q.durationMs, 0);
  const slowestQueryMs = lookups.reduce(
    (max, q) => Math.max(max, q.durationMs),
    0,
  );
  const allFromCache =
    lookups.length > 0 && lookups.every((q) => q.fromCache);
  const anyNetworkFetch = lookups.some((q) => !q.fromCache);
  const slowNetworkFetch = lookups.some(
    (q) => !q.fromCache && q.durationMs >= 250,
  );
  const fastNetworkFetch = lookups.some(
    (q) => !q.fromCache && q.durationMs < 250,
  );

  let likelyBottleneck: ExtinguisherSearchDiagnosticReport['summary']['likelyBottleneck'];
  let interpretation: string;

  if (allFromCache) {
    likelyBottleneck = 'local-cache';
    interpretation =
      'All identifier queries were served from the local Firestore cache. Slowness is unlikely to be Firestore index cost; check UI debounce (280ms), client filtering, or loading the full inventory snapshot.';
  } else if (slowNetworkFetch && !fastNetworkFetch) {
    likelyBottleneck = 'network-latency';
    interpretation =
      'Queries waited on the network (fromCache=false, high duration). This often points to connection quality or geographic latency rather than missing indexes.';
  } else if (fastNetworkFetch && !slowNetworkFetch) {
    likelyBottleneck = 'firestore-server';
    interpretation =
      'Network round-trips were quick. If search still feels slow, check sequential lookup waves, legacy fallback (8 extra queries), or substring search over the full local inventory list.';
  } else {
    likelyBottleneck = 'mixed';
    interpretation =
      'Some queries hit cache and others hit the network. Re-run after a warm cache, or use server Query Explain (includeServerExplain) to inspect index scans.';
  }

  return {
    totalDurationMs,
    slowestQueryMs,
    allFromCache,
    anyNetworkFetch,
    likelyBottleneck,
    interpretation,
  };
}

async function runLookupFieldQuery(
  orgId: string,
  field: ExtinguisherLookupField,
  code: string,
  perFieldLimit: number,
  queryType: LookupQueryType,
): Promise<{ snap: QuerySnapshot; diagnostic: ExtinguisherLookupQueryDiagnostic }> {
  const colRef = collection(db, 'org', orgId, 'extinguishers');
  const constraints: QueryConstraint[] = [where('deletedAt', '==', null)];
  const filters = ['deletedAt==null'];
  if (queryType === 'strict-active') {
    constraints.push(where('lifecycleStatus', '==', 'active'));
    filters.push('lifecycleStatus==active');
  }
  constraints.push(where(field, '==', code));
  filters.push(`${field}==…`);
  constraints.push(limit(perFieldLimit));

  const t0 = performance.now();
  const snap = await getDocs(query(colRef, ...constraints));
  const diagnostic: ExtinguisherLookupQueryDiagnostic = {
    field,
    queryType,
    durationMs: Math.round(performance.now() - t0),
    fromCache: snap.metadata.fromCache,
    docCount: snap.size,
    docIds: snap.docs.map((d) => d.id),
    filters,
    limit: perFieldLimit,
  };
  exSearchLog(`${queryType} field=${field}`, {
    collectionPath: collectionPathExtinguishers(orgId),
    ...diagnostic,
  });
  return { snap, diagnostic };
}

async function runStrictLookupWave(
  orgId: string,
  code: string,
  perFieldLimit: number,
  collectDiagnostics = false,
): Promise<{
  snaps: QuerySnapshot[];
  diagnostics: ExtinguisherLookupQueryDiagnostic[];
}> {
  const results = await Promise.all(
    EXTINGUISHER_LOOKUP_FIELDS.map((field) =>
      runLookupFieldQuery(orgId, field, code, perFieldLimit, 'strict-active'),
    ),
  );
  return {
    snaps: results.map((r) => r.snap),
    diagnostics: collectDiagnostics ? results.map((r) => r.diagnostic) : [],
  };
}

async function runLegacyLookupWave(
  orgId: string,
  code: string,
  perFieldLimit: number,
  collectDiagnostics = false,
): Promise<{
  snaps: QuerySnapshot[];
  diagnostics: ExtinguisherLookupQueryDiagnostic[];
}> {
  exSearchWarn(
    'Running legacy identifier lookup (lifecycle not in query). Still only org/.../extinguishers — no inspections/workspaces loaded.',
    { perFieldLimit },
  );
  const results = await Promise.all(
    EXTINGUISHER_LOOKUP_FIELDS.map((field) =>
      runLookupFieldQuery(
        orgId,
        field,
        code,
        perFieldLimit,
        'legacy-deletedAt-only',
      ),
    ),
  );
  return {
    snaps: results.map((r) => r.snap),
    diagnostics: collectDiagnostics ? results.map((r) => r.diagnostic) : [],
  };
}

/**
 * Run client-side identifier lookup diagnostics. Enable `localStorage EX3_DEBUG_SEARCH=1`
 * (or use Vite dev) for console logs. Pass `{ includeServerExplain: true }` for Admin
 * Query Explain via the explainExtinguisherSearch callable (owner/admin, analyze=false
 * by default).
 */
export async function diagnoseExtinguisherIdentifierSearch(
  orgId: string,
  rawQuery: string,
  options: {
    includeServerExplain?: boolean;
    /** When true with includeServerExplain, executes queries server-side (billed reads). */
    analyze?: boolean;
    includeInventoryListExplain?: boolean;
  } = {},
): Promise<ExtinguisherSearchDiagnosticReport> {
  const code = rawQuery.trim();
  if (!code) {
    throw new Error('searchInput is required.');
  }

  const strict = await runStrictLookupWave(orgId, code, IDENTIFIER_LOOKUP_PER_FIELD_LIMIT, true);
  let clientLookups = strict.diagnostics;
  const strictHits = collectActiveMatchesFromOrderedSnaps(strict.snaps, 1);
  if (
    strictHits.length === 0 &&
    totalDocsInSnaps(strict.snaps) === 0
  ) {
    const legacy = await runLegacyLookupWave(
      orgId,
      code,
      IDENTIFIER_LOOKUP_PER_FIELD_LIMIT,
      true,
    );
    clientLookups = clientLookups.concat(legacy.diagnostics);
  }

  const report: ExtinguisherSearchDiagnosticReport = {
    searchInput: code,
    orgId,
    clientLookups,
    summary: summarizeLookupDiagnostics(clientLookups),
  };

  if (options.includeServerExplain) {
    const fn = httpsCallable(functions, 'explainExtinguisherSearch');
    const { data } = await fn({
      orgId,
      searchInput: code,
      analyze: options.analyze ?? false,
      includeInventoryList: options.includeInventoryListExplain ?? true,
    });
    report.serverExplain = data;
  }

  if (isExSearchDebugEnabled()) {
    console.info('[EX3 extinguisher search] diagnose report', report);
  }
  return report;
}

declare global {
  interface Window {
    __EX3_diagnoseExtinguisherSearch?: typeof diagnoseExtinguisherIdentifierSearch;
  }
}

if (typeof window !== 'undefined' && isExSearchDebugEnabled()) {
  window.__EX3_diagnoseExtinguisherSearch = diagnoseExtinguisherIdentifierSearch;
  exSearchLog(
    'Debug enabled. In console: await __EX3_diagnoseExtinguisherSearch(orgId, "SERIAL123")',
  );
  exSearchLog(
    'For Firestore Query Explain indexes: await __EX3_diagnoseExtinguisherSearch(orgId, "SERIAL123", { includeServerExplain: true, analyze: true })',
  );
}

function collectActiveMatchesFromOrderedSnaps(
  snaps: QuerySnapshot[],
  maxResults: number,
): Extinguisher[] {
  const seen = new Set<string>();
  const out: Extinguisher[] = [];
  for (let i = 0; i < EXTINGUISHER_LOOKUP_FIELDS.length; i++) {
    for (const d of snaps[i].docs) {
      if (seen.has(d.id)) continue;
      if (!isInventoryActiveRecord(d.data() as Record<string, unknown>))
        continue;
      seen.add(d.id);
      out.push({ id: d.id, ...d.data() } as Extinguisher);
      if (out.length >= maxResults) return out;
    }
  }
  return out;
}

/**
 * Exact-match active inventory by barcode, asset ID, serial, or QR (parallel queries, max ~20 docs read).
 * Used by Inventory identifier search; does not query inspections or workspaces.
 */
export async function fetchActiveExtinguisherIdentifierMatches(
  orgId: string,
  rawQuery: string,
  maxResults = 20,
): Promise<Extinguisher[]> {
  const code = rawQuery.trim();
  if (!code) return [];
  const timer = `[EX3 search] fetchActiveExtinguisherIdentifierMatches:${code.slice(0, 28)}`;
  if (isExSearchDebugEnabled()) console.time(timer);
  try {
    exSearchLog('fetchActiveExtinguisherIdentifierMatches', {
      searchInput: code,
      orgId,
      maxResults,
      collectionPath: collectionPathExtinguishers(orgId),
    });
    const out = await lookupActiveExtinguisherByIdentifier(orgId, code, maxResults, {
      useSessionCache: false,
    });
    exSearchLog('fetchActiveExtinguisherIdentifierMatches result', {
      count: out.length,
      ids: out.map((e) => e.id),
    });
    return out.slice(0, maxResults);
  } finally {
    if (isExSearchDebugEnabled()) console.timeEnd(timer);
  }
}

export interface Extinguisher {
  id?: string;
  assetId: string;
  serial: string;
  barcode: string | null;
  barcodeFormat: string | null;
  qrCodeValue: string | null;
  qrCodeUrl: string | null;
  manufacturer: string | null;
  category: string; // standard, spare, replaced, retired, out_of_service
  extinguisherType: string | null;
  serviceClass: string | null;
  extinguisherSize: string | null;
  manufactureDate: unknown | null;
  manufactureYear: number | null;
  installDate: unknown | null;
  inServiceDate: unknown | null;
  expirationYear: number | null;
  isExpired: boolean | null;
  vicinity: string;
  parentLocation: string;
  section: string;
  /** Optional denormalized floor label, e.g. "Floor 2" / "Basement". */
  floor?: string;
  locationId: string | null;
  photos: Array<{
    url: string;
    path: string;
    uploadedAt: unknown;
    uploadedBy: string;
    type: string | null;
  }>;
  // Monthly / compliance lifecycle
  lastMonthlyInspection: unknown | null;
  nextMonthlyInspection: unknown | null;
  lastAnnualInspection: unknown | null;
  nextAnnualInspection: unknown | null;
  annualInspectorName: string | null;
  annualInspectorCompany: string | null;
  annualInspectionNotes: string | null;
  lastSixYearMaintenance: unknown | null;
  nextSixYearMaintenance: unknown | null;
  requiresSixYearMaintenance: boolean | null;
  lastHydroTest: unknown | null;
  nextHydroTest: unknown | null;
  hydroTestIntervalYears: number | null;
  lifecycleStatus: string | null;
  complianceStatus: string | null;
  overdueFlags: string[];
  // Replacement tracking
  replacedByExtId: string | null;
  replacesExtId: string | null;
  replacementHistory: Array<{
    replacedExtId: string;
    replacedAssetId: string;
    replacedAt: unknown;
    replacedBy: string;
    replacedByEmail: string;
    reason: string | null;
  }>;
  // Retirement tracking
  retiredAt: unknown | null;
  retiredBy: string | null;
  retirementReason: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
  deletedAt: unknown | null;
  deletedBy: string | null;
  deletionReason: string | null;
  /** Denormalized inventory flags (aligned with lifecycleStatus when set). */
  status?: string | null;
  isActive?: boolean | null;
  /** Optional free-form asset notes */
  notes?: string | null;
}

/** Active inventory row: not deleted and lifecycle is active (or unset legacy). */
export function isInventoryActiveRecord(
  data: Record<string, unknown>,
): boolean {
  const ls = data.lifecycleStatus as string | null | undefined;
  const category = data.category as string | null | undefined;
  const status = data.status as string | null | undefined;
  const isActive = data.isActive as boolean | null | undefined;
  if (ls === 'replaced' || ls === 'retired' || ls === 'deleted') return false;
  if (
    category === 'replaced' ||
    category === 'retired' ||
    category === 'out_of_service'
  )
    return false;
  if (status != null && status !== 'active') return false;
  if (isActive === false) return false;
  return ls === 'active' || ls == null || ls === '';
}

export function isOfficiallyExpiredExtinguisher(
  data: Pick<Extinguisher, 'isExpired'>,
): boolean {
  return data.isExpired === true;
}

export function isPossibleExpiredCandidate(
  data: Pick<Extinguisher, 'isExpired' | 'manufactureYear'> &
    Partial<Extinguisher>,
  currentYear = new Date().getFullYear(),
): boolean {
  if (isOfficiallyExpiredExtinguisher(data)) return false;
  if (!isInventoryActiveRecord(data as unknown as Record<string, unknown>))
    return false;
  return (
    typeof data.manufactureYear === 'number' &&
    data.manufactureYear <= currentYear - 6
  );
}

function extinguishersRef(orgId: string) {
  return collection(db, 'org', orgId, 'extinguishers');
}

function sanitizeScannedCodeForAssetId(code: string): string {
  const sanitized = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (sanitized) {
    return sanitized.slice(0, 24);
  }

  return `ITEM-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Count of lifecycle-active extinguishers (non-deleted).
 */
export async function getActiveExtinguisherCount(
  orgId: string,
): Promise<number> {
  const q = query(
    extinguishersRef(orgId),
    where('deletedAt', '==', null),
    where('lifecycleStatus', '==', 'active'),
  );
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

/**
 * Check if an assetId already exists in the org.
 */
export async function isAssetIdTaken(
  orgId: string,
  assetId: string,
  excludeId?: string,
): Promise<boolean> {
  const col = extinguishersRef(orgId);
  const q1 = query(
    col,
    where('assetId', '==', assetId),
    where('deletedAt', '==', null),
    where('lifecycleStatus', '==', 'active'),
    limit(8),
  );
  let snap = await getDocs(q1);
  const strictHit = excludeId
    ? snap.docs.some((d) => d.id !== excludeId)
    : !snap.empty;
  if (strictHit) return true;

  const q2 = query(
    col,
    where('assetId', '==', assetId),
    where('deletedAt', '==', null),
  );
  snap = await getDocs(q2);
  return snap.docs.some((d) => {
    if (excludeId && d.id === excludeId) return false;
    return isInventoryActiveRecord(d.data() as Record<string, unknown>);
  });
}

/**
 * Check if a serial number is already in use by an active extinguisher.
 */
export async function isSerialTaken(
  orgId: string,
  serial: string,
  excludeId?: string,
): Promise<boolean> {
  const col = extinguishersRef(orgId);
  const q1 = query(
    col,
    where('serial', '==', serial),
    where('deletedAt', '==', null),
    where('lifecycleStatus', '==', 'active'),
    limit(8),
  );
  let snap = await getDocs(q1);
  const strictHit = excludeId
    ? snap.docs.some((d) => d.id !== excludeId)
    : !snap.empty;
  if (strictHit) return true;

  const q2 = query(
    col,
    where('serial', '==', serial),
    where('deletedAt', '==', null),
  );
  snap = await getDocs(q2);
  return snap.docs.some((d) => {
    if (excludeId && d.id === excludeId) return false;
    return isInventoryActiveRecord(d.data() as Record<string, unknown>);
  });
}

/**
 * True if another active inventory extinguisher uses this barcode.
 */
export async function isBarcodeTaken(
  orgId: string,
  barcode: string,
  excludeId?: string,
): Promise<boolean> {
  const trimmed = barcode.trim();
  if (!trimmed) return false;
  const col = extinguishersRef(orgId);
  const q1 = query(
    col,
    where('barcode', '==', trimmed),
    where('deletedAt', '==', null),
    where('lifecycleStatus', '==', 'active'),
    limit(8),
  );
  let snap = await getDocs(q1);
  const strictHit = excludeId
    ? snap.docs.some((d) => d.id !== excludeId)
    : !snap.empty;
  if (strictHit) return true;

  const q2 = query(
    col,
    where('barcode', '==', trimmed),
    where('deletedAt', '==', null),
  );
  snap = await getDocs(q2);
  return snap.docs.some((d) => {
    if (excludeId && d.id === excludeId) return false;
    return isInventoryActiveRecord(d.data() as Record<string, unknown>);
  });
}

/**
 * Generate a unique asset ID for extinguisher records created directly from a scan.
 */
export async function generateScannedAssetId(
  orgId: string,
  code: string,
): Promise<string> {
  const base = `SCAN-${sanitizeScannedCodeForAssetId(code)}`;
  let candidate = base;
  let suffix = 2;

  while (await isAssetIdTaken(orgId, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/**
 * Create a new extinguisher.
 */
export async function createExtinguisher(
  orgId: string,
  uid: string,
  data: Partial<Extinguisher>,
): Promise<string> {
  const docData = {
    assetId: data.assetId ?? '',
    serial: data.serial ?? '',
    barcode: data.barcode ?? null,
    barcodeFormat: data.barcodeFormat ?? null,
    qrCodeValue: null,
    qrCodeUrl: null,
    manufacturer: data.manufacturer ?? null,
    category: data.category ?? 'standard',
    extinguisherType: data.extinguisherType ?? null,
    serviceClass: data.serviceClass ?? null,
    extinguisherSize: data.extinguisherSize ?? null,
    manufactureDate: data.manufactureDate ?? null,
    manufactureYear: data.manufactureYear ?? null,
    installDate: data.installDate ?? null,
    inServiceDate: data.inServiceDate ?? null,
    expirationYear: data.expirationYear ?? null,
    isExpired: data.isExpired ?? false,
    vicinity: data.vicinity ?? '',
    parentLocation: data.parentLocation ?? '',
    section: data.section ?? '',
    floor: data.floor ?? '',
    locationId: data.locationId ?? null,
    photos: [],
    lastMonthlyInspection: null,
    nextMonthlyInspection: null,
    lastAnnualInspection: null,
    nextAnnualInspection: null,
    lastSixYearMaintenance: data.lastSixYearMaintenance ?? null,
    nextSixYearMaintenance: data.nextSixYearMaintenance ?? null,
    lastHydroTest: data.lastHydroTest ?? null,
    nextHydroTest: data.nextHydroTest ?? null,
    requiresSixYearMaintenance: null,
    hydroTestIntervalYears: null,
    lifecycleStatus: 'active',
    status: 'active',
    isActive: true,
    complianceStatus: 'compliant',
    overdueFlags: [],
    replacedByExtId: null,
    replacesExtId: null,
    replacementHistory: [],
    retiredAt: null,
    retiredBy: null,
    retirementReason: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
  };

  const docRef = await addDoc(extinguishersRef(orgId), docData);
  return docRef.id;
}

/**
 * Update an extinguisher.
 */
export async function updateExtinguisher(
  orgId: string,
  extId: string,
  data: Partial<Extinguisher>,
): Promise<void> {
  const ref = doc(db, 'org', orgId, 'extinguishers', extId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}
/**
 * Remove all pending inspection records for given extinguisher IDs.
 * Completed (pass/fail) inspections are preserved for audit history.
 */
async function removePendingInspections(
  orgId: string,
  extIds: string[],
): Promise<void> {
  // Firestore 'in' queries support max 30 values per clause
  const chunkSize = 30;
  for (let i = 0; i < extIds.length; i += chunkSize) {
    const chunk = extIds.slice(i, i + chunkSize);
    const q = query(
      collection(db, 'org', orgId, 'inspections'),
      where('extinguisherId', 'in', chunk),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(q);
    if (snap.empty) continue;

    // Delete in batches of 499
    const docs = snap.docs;
    for (let j = 0; j < docs.length; j += 499) {
      const batch = writeBatch(db);
      const batchDocs = docs.slice(j, j + 499);
      for (const d of batchDocs) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  }
}

/**
 * Soft-delete an extinguisher.
 * Also removes any pending inspection records for it.
 */
export async function softDeleteExtinguisher(
  orgId: string,
  extId: string,
  uid: string,
  reason: string,
): Promise<void> {
  const ref = doc(db, 'org', orgId, 'extinguishers', extId);
  await updateDoc(ref, {
    lifecycleStatus: 'deleted',
    status: 'deleted',
    isActive: false,
    deletedAt: serverTimestamp(),
    deletedBy: uid,
    deletionReason: reason,
    updatedAt: serverTimestamp(),
  });
  // Clean up pending inspections so they don't show in workspaces
  await removePendingInspections(orgId, [extId]);
}

/**
 * Clean up orphaned pending inspections for all deleted extinguishers.
 * Use this to fix existing data where extinguishers were deleted
 * before the inspection cleanup was added.
 */
export async function cleanupOrphanedPendingInspections(
  orgId: string,
): Promise<number> {
  // Get all deleted extinguisher IDs using lifecycleStatus (avoids != query)
  const deletedQuery = query(
    collection(db, 'org', orgId, 'extinguishers'),
    where('lifecycleStatus', '==', 'deleted'),
  );
  const deletedSnap = await getDocs(deletedQuery);
  if (deletedSnap.empty) return 0;

  const deletedIds = deletedSnap.docs.map((d) => d.id);

  // Find and remove their pending inspections
  // Firestore 'in' supports max 30 values per query
  let totalRemoved = 0;
  const chunkSize = 30;
  for (let i = 0; i < deletedIds.length; i += chunkSize) {
    const chunk = deletedIds.slice(i, i + chunkSize);
    const q = query(
      collection(db, 'org', orgId, 'inspections'),
      where('extinguisherId', 'in', chunk),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(q);
    if (snap.empty) continue;

    const docs = snap.docs;
    for (let j = 0; j < docs.length; j += 499) {
      const b = writeBatch(db);
      const batchDocs = docs.slice(j, j + 499);
      for (const d of batchDocs) {
        b.delete(d.ref);
      }
      await b.commit();
      totalRemoved += batchDocs.length;
    }
  }
  return totalRemoved;
}

/**
 * Restore a soft-deleted extinguisher.
 */
export async function restoreExtinguisher(
  orgId: string,
  extId: string,
): Promise<void> {
  const ref = doc(db, 'org', orgId, 'extinguishers', extId);
  await updateDoc(ref, {
    lifecycleStatus: 'active',
    status: 'active',
    isActive: true,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Batch soft-delete multiple extinguishers.
 * Also removes any pending inspection records for them.
 * Chunks to 499 operations per batch.
 */
export async function batchSoftDeleteExtinguishers(
  orgId: string,
  extIds: string[],
  uid: string,
  reason: string,
): Promise<void> {
  const chunkSize = 499;
  for (let i = 0; i < extIds.length; i += chunkSize) {
    const chunk = extIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const extId of chunk) {
      const ref = doc(db, 'org', orgId, 'extinguishers', extId);
      batch.update(ref, {
        lifecycleStatus: 'deleted',
        status: 'deleted',
        isActive: false,
        deletedAt: serverTimestamp(),
        deletedBy: uid,
        deletionReason: reason,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  // Clean up pending inspections so they don't show in workspaces
  await removePendingInspections(orgId, extIds);
}

/**
 * Get a single extinguisher by ID.
 */
export async function getExtinguisher(
  orgId: string,
  extId: string,
): Promise<Extinguisher | null> {
  const ref = doc(db, 'org', orgId, 'extinguishers', extId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Extinguisher;
}

/**
 * Look up an extinguisher by barcode, asset ID, serial, or QR value.
 * Only returns lifecycle-active inventory (replaced/retired units are ignored).
 *
 * Uses a few parallel Firestore rounds on `org/{orgId}/extinguishers` only (no
 * inspections/workspaces). Legacy rows missing `lifecycleStatus` use a
 * bounded second wave (limit per field).
 */
export async function findExtinguisherByCode(
  orgId: string,
  code: string,
): Promise<Extinguisher | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const timer = `[EX3 search] findExtinguisherByCode:${trimmed.slice(0, 40)}`;
  if (isExSearchDebugEnabled()) console.time(timer);
  try {
    exSearchLog('findExtinguisherByCode start', {
      searchInput: trimmed,
      orgId,
      collectionPath: collectionPathExtinguishers(orgId),
      phases: [
        'strict limit 8 (4 fields parallel)',
        'legacy limit 8 only if strict returned zero docs',
      ],
      note: 'Session cache reused for repeat scans of the same code within 5 minutes.',
    });

    const hits = await lookupActiveExtinguisherByIdentifier(orgId, trimmed, 1, {
      useSessionCache: true,
    });
    const hit = hits[0] ?? null;
    if (hit) {
      exSearchLog('findExtinguisherByCode hit', { pickedDocId: hit.id });
      return hit;
    }

    exSearchLog('findExtinguisherByCode miss', { searchInput: trimmed });
    return null;
  } finally {
    if (isExSearchDebugEnabled()) console.timeEnd(timer);
  }
}

export interface ExtinguisherListOptions {
  category?: string;
  section?: string;
  locationId?: string;
  complianceStatus?: string;
  showDeleted?: boolean;
  searchField?: 'assetId' | 'barcode' | 'serial';
  searchValue?: string;
  pageSize?: number;
  lastDoc?: DocumentSnapshot;
}

/**
 * Fetch a paginated list of extinguishers.
 */
export async function listExtinguishers(
  orgId: string,
  options: ExtinguisherListOptions = {},
): Promise<{ items: Extinguisher[]; lastDoc: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [];

  if (options.showDeleted) {
    constraints.push(where('deletedAt', '!=', null));
  } else {
    constraints.push(where('deletedAt', '==', null));
  }

  if (options.category) {
    constraints.push(where('category', '==', options.category));
  }
  if (options.section) {
    constraints.push(where('section', '==', options.section));
  }
  if (options.locationId) {
    constraints.push(where('locationId', '==', options.locationId));
  }
  if (options.complianceStatus) {
    constraints.push(where('complianceStatus', '==', options.complianceStatus));
  }
  if (options.searchField && options.searchValue) {
    constraints.push(where(options.searchField, '==', options.searchValue));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(options.pageSize ?? 25));

  if (options.lastDoc) {
    constraints.push(startAfter(options.lastDoc));
  }

  const q = query(extinguishersRef(orgId), ...constraints);
  const snap = await getDocs(q);

  const items: Extinguisher[] = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Extinguisher[];

  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { items, lastDoc };
}

/**
 * One-time fetch of ALL active (non-deleted) extinguishers.
 * Used for duplicate detection and data quality scans.
 * WARNING: may be large for orgs with many extinguishers.
 */
export async function getAllActiveExtinguishers(
  orgId: string,
): Promise<Extinguisher[]> {
  const q = query(
    extinguishersRef(orgId),
    where('deletedAt', '==', null),
    where('lifecycleStatus', '==', 'active'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Extinguisher[];
}

export interface ReplacementHistoryRow {
  id: string;
  orgId?: string;
  currentExtinguisherId?: string;
  replacedAt: unknown;
  reason: string | null;
  notes?: string | null;
  previousAssetId?: string | null;
  previousSerial: string | null;
  previousBarcode: string | null;
  newAssetId?: string | null;
  newSerial?: string | null;
  newBarcode?: string | null;
  waitingForService?: boolean;
  sentForService?: boolean;
  discarded?: boolean;
  returned?: boolean;
  returnedSpareExtinguisherId?: string | null;
  priorSnapshot?: Record<string, unknown>;
}

/**
 * Real-time listener for in-place replacement snapshots (subcollection).
 */
export function subscribeToReplacementHistory(
  orgId: string,
  extinguisherId: string,
  callback: (rows: ReplacementHistoryRow[]) => void,
): () => void {
  const colRef = collection(
    db,
    'org',
    orgId,
    'extinguishers',
    extinguisherId,
    'replacementHistory',
  );
  const q = query(colRef, orderBy('replacedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const rows: ReplacementHistoryRow[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        orgId: (data.orgId as string | undefined) ?? undefined,
        currentExtinguisherId:
          (data.currentExtinguisherId as string | undefined) ?? undefined,
        replacedAt: data.replacedAt,
        reason: (data.reason as string | null) ?? null,
        notes: (data.notes as string | null) ?? null,
        previousAssetId: (data.previousAssetId as string | null) ?? null,
        previousSerial: (data.previousSerial as string | null) ?? null,
        previousBarcode: (data.previousBarcode as string | null) ?? null,
        newAssetId: (data.newAssetId as string | null) ?? null,
        newSerial: (data.newSerial as string | null) ?? null,
        newBarcode: (data.newBarcode as string | null) ?? null,
        waitingForService: data.waitingForService === true,
        sentForService: data.sentForService === true,
        discarded: data.discarded === true,
        returned: data.returned === true,
        returnedSpareExtinguisherId:
          (data.returnedSpareExtinguisherId as string | null) ?? null,
        priorSnapshot: data.priorSnapshot as
          | Record<string, unknown>
          | undefined,
      };
    });
    callback(rows);
  });
}

/**
 * Subscribe to real-time updates for the extinguisher list.
 */
export function subscribeToExtinguishers(
  orgId: string,
  callback: (items: Extinguisher[]) => void,
  options: { showDeleted?: boolean; limit?: number } = {},
): () => void {
  const constraints: QueryConstraint[] = [];

  if (options.showDeleted) {
    constraints.push(where('deletedAt', '!=', null));
  } else {
    constraints.push(where('deletedAt', '==', null));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  if (options.limit) {
    constraints.push(limit(options.limit));
  }

  const q = query(extinguishersRef(orgId), ...constraints);
  let loggedInitialSnapshot = false;

  return onSnapshot(q, (snap) => {
    if (isExSearchDebugEnabled() && !loggedInitialSnapshot) {
      loggedInitialSnapshot = true;
      exSearchLog('subscribeToExtinguishers initial snapshot', {
        orgId,
        docCount: snap.size,
        fromCache: snap.metadata.fromCache,
        showDeleted: options.showDeleted ?? false,
        limit: options.limit ?? null,
        note:
          'Inventory loads the full active list (no limit). Large orgs: substring/location search filters this snapshot client-side.',
      });
    }
    const items: Extinguisher[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Extinguisher[];
    callback(items);
  });
}

/**
 * Batch update multiple extinguishers with partial data.
 * Chunks to 499 operations per batch.
 */
export async function batchUpdateExtinguishers(
  orgId: string,
  updates: Array<{ extId: string; data: Partial<Extinguisher> }>,
): Promise<void> {
  const chunkSize = 499;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const update of chunk) {
      const ref = doc(db, 'org', orgId, 'extinguishers', update.extId);
      batch.update(ref, {
        ...update.data,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
