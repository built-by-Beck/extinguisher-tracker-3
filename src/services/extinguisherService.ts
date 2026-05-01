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
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';

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
export function isInventoryActiveRecord(data: Record<string, unknown>): boolean {
  const ls = data.lifecycleStatus as string | null | undefined;
  const category = data.category as string | null | undefined;
  const status = data.status as string | null | undefined;
  const isActive = data.isActive as boolean | null | undefined;
  if (ls === 'replaced' || ls === 'retired' || ls === 'deleted') return false;
  if (category === 'replaced' || category === 'retired' || category === 'out_of_service') return false;
  if (status != null && status !== 'active') return false;
  if (isActive === false) return false;
  return ls === 'active' || ls == null || ls === '';
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
export async function getActiveExtinguisherCount(orgId: string): Promise<number> {
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
export async function isAssetIdTaken(orgId: string, assetId: string, excludeId?: string): Promise<boolean> {
  const col = extinguishersRef(orgId);
  const q1 = query(
    col,
    where('assetId', '==', assetId),
    where('deletedAt', '==', null),
    where('lifecycleStatus', '==', 'active'),
    limit(8),
  );
  let snap = await getDocs(q1);
  const strictHit = excludeId ? snap.docs.some((d) => d.id !== excludeId) : !snap.empty;
  if (strictHit) return true;

  const q2 = query(col, where('assetId', '==', assetId), where('deletedAt', '==', null), limit(16));
  snap = await getDocs(q2);
  return snap.docs.some((d) => {
    if (excludeId && d.id === excludeId) return false;
    return isInventoryActiveRecord(d.data() as Record<string, unknown>);
  });
}

/**
 * Check if a serial number is already in use by an active extinguisher.
 */
export async function isSerialTaken(orgId: string, serial: string, excludeId?: string): Promise<boolean> {
  const col = extinguishersRef(orgId);
  const q1 = query(
    col,
    where('serial', '==', serial),
    where('deletedAt', '==', null),
    where('lifecycleStatus', '==', 'active'),
    limit(8),
  );
  let snap = await getDocs(q1);
  const strictHit = excludeId ? snap.docs.some((d) => d.id !== excludeId) : !snap.empty;
  if (strictHit) return true;

  const q2 = query(col, where('serial', '==', serial), where('deletedAt', '==', null), limit(16));
  snap = await getDocs(q2);
  return snap.docs.some((d) => {
    if (excludeId && d.id === excludeId) return false;
    return isInventoryActiveRecord(d.data() as Record<string, unknown>);
  });
}

/**
 * True if another active inventory extinguisher uses this barcode.
 */
export async function isBarcodeTaken(orgId: string, barcode: string, excludeId?: string): Promise<boolean> {
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
  const strictHit = excludeId ? snap.docs.some((d) => d.id !== excludeId) : !snap.empty;
  if (strictHit) return true;

  const q2 = query(col, where('barcode', '==', trimmed), where('deletedAt', '==', null), limit(16));
  snap = await getDocs(q2);
  return snap.docs.some((d) => {
    if (excludeId && d.id === excludeId) return false;
    return isInventoryActiveRecord(d.data() as Record<string, unknown>);
  });
}

/**
 * Generate a unique asset ID for extinguisher records created directly from a scan.
 */
export async function generateScannedAssetId(orgId: string, code: string): Promise<string> {
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
    locationId: data.locationId ?? null,
    photos: [],
    lastMonthlyInspection: null,
    nextMonthlyInspection: null,
    lastAnnualInspection: null,
    nextAnnualInspection: null,
    lastSixYearMaintenance: data.lastSixYearMaintenance ?? null,
    nextSixYearMaintenance: null,
    lastHydroTest: data.lastHydroTest ?? null,
    nextHydroTest: null,
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
async function removePendingInspections(orgId: string, extIds: string[]): Promise<void> {
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
export async function cleanupOrphanedPendingInspections(orgId: string): Promise<number> {
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
export async function getExtinguisher(orgId: string, extId: string): Promise<Extinguisher | null> {
  const ref = doc(db, 'org', orgId, 'extinguishers', extId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Extinguisher;
}

/**
 * Look up an extinguisher by barcode, asset ID, serial, or QR value.
 * Only returns lifecycle-active inventory (replaced/retired units are ignored).
 */
export async function findExtinguisherByCode(
  orgId: string,
  code: string,
): Promise<Extinguisher | null> {
  const colRef = collection(db, 'org', orgId, 'extinguishers');
  const fields = ['barcode', 'assetId', 'serial', 'qrCodeValue'] as const;

  for (const field of fields) {
    const q = query(
      colRef,
      where('deletedAt', '==', null),
      where('lifecycleStatus', '==', 'active'),
      where(field, '==', code),
      limit(12),
    );
    const snap = await getDocs(q);
    const hit = snap.docs.find((d) => isInventoryActiveRecord(d.data() as Record<string, unknown>));
    if (hit) {
      const ext = { id: hit.id, ...hit.data() } as Extinguisher;
      // #region agent log
      fetch('http://127.0.0.1:7590/ingest/60982b77-4867-44d4-bb0e-2b2e4905ad1d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6badb8' },
        body: JSON.stringify({
          sessionId: '6badb8',
          location: 'extinguisherService.ts:findExtinguisherByCode',
          message: 'match_strict',
          data: { field, extId: ext.id, lifecycle: ext.lifecycleStatus ?? null },
          timestamp: Date.now(),
          hypothesisId: 'H1',
        }),
      }).catch(() => {});
      // #endregion
      return ext;
    }
  }

  for (const field of fields) {
    const q = query(colRef, where('deletedAt', '==', null), where(field, '==', code), limit(12));
    const snap = await getDocs(q);
    const hit = snap.docs.find((d) => isInventoryActiveRecord(d.data() as Record<string, unknown>));
    if (hit) {
      const ext = { id: hit.id, ...hit.data() } as Extinguisher;
      // #region agent log
      fetch('http://127.0.0.1:7590/ingest/60982b77-4867-44d4-bb0e-2b2e4905ad1d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6badb8' },
        body: JSON.stringify({
          sessionId: '6badb8',
          location: 'extinguisherService.ts:findExtinguisherByCode',
          message: 'match_legacy_fallback',
          data: { field, extId: ext.id, lifecycle: ext.lifecycleStatus ?? null },
          timestamp: Date.now(),
          hypothesisId: 'H4',
        }),
      }).catch(() => {});
      // #endregion
      return ext;
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7590/ingest/60982b77-4867-44d4-bb0e-2b2e4905ad1d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6badb8' },
    body: JSON.stringify({
      sessionId: '6badb8',
      location: 'extinguisherService.ts:findExtinguisherByCode',
      message: 'no_match',
      data: { trimmedLen: code.trim().length },
      timestamp: Date.now(),
      hypothesisId: 'H1',
    }),
  }).catch(() => {});
  // #endregion
  return null;
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
export async function getAllActiveExtinguishers(orgId: string): Promise<Extinguisher[]> {
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
  replacedAt: unknown;
  reason: string | null;
  previousSerial: string | null;
  previousBarcode: string | null;
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
  const colRef = collection(db, 'org', orgId, 'extinguishers', extinguisherId, 'replacementHistory');
  const q = query(colRef, orderBy('replacedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const rows: ReplacementHistoryRow[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        replacedAt: data.replacedAt,
        reason: (data.reason as string | null) ?? null,
        previousSerial: (data.previousSerial as string | null) ?? null,
        previousBarcode: (data.previousBarcode as string | null) ?? null,
        priorSnapshot: data.priorSnapshot as Record<string, unknown> | undefined,
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

  return onSnapshot(q, (snap) => {
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
