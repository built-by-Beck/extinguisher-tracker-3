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
 * Get total count of active (non-deleted) extinguishers.
 */
export async function getActiveExtinguisherCount(orgId: string): Promise<number> {
  const q = query(extinguishersRef(orgId), where('deletedAt', '==', null));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

/**
 * Check if an assetId already exists in the org.
 */
export async function isAssetIdTaken(orgId: string, assetId: string, excludeId?: string): Promise<boolean> {
  const q = query(
    extinguishersRef(orgId),
    where('assetId', '==', assetId),
    where('deletedAt', '==', null),
    limit(2),
  );
  const snap = await getDocs(q);
  if (excludeId) {
    return snap.docs.some((d) => d.id !== excludeId);
  }
  return !snap.empty;
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
    vicinity: data.vicinity ?? '',
    parentLocation: data.parentLocation ?? '',
    section: data.section ?? '',
    locationId: data.locationId ?? null,
    photos: [],
    lastMonthlyInspection: null,
    nextMonthlyInspection: null,
    lastAnnualInspection: null,
    nextAnnualInspection: null,
    lastSixYearMaintenance: null,
    nextSixYearMaintenance: null,
    lastHydroTest: null,
    nextHydroTest: null,
    requiresSixYearMaintenance: null,
    hydroTestIntervalYears: null,
    lifecycleStatus: 'active',
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
 * Soft-delete an extinguisher.
 */
export async function softDeleteExtinguisher(
  orgId: string,
  extId: string,
  uid: string,
  reason: string,
): Promise<void> {
  const ref = doc(db, 'org', orgId, 'extinguishers', extId);
  await updateDoc(ref, {
    deletedAt: serverTimestamp(),
    deletedBy: uid,
    deletionReason: reason,
    updatedAt: serverTimestamp(),
  });
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
 * Searches active (non-deleted) extinguishers within the org.
 */
export async function findExtinguisherByCode(
  orgId: string,
  code: string,
): Promise<Extinguisher | null> {
  const colRef = collection(db, 'org', orgId, 'extinguishers');

  // Search fields in priority order
  const fields = ['barcode', 'assetId', 'serial', 'qrCodeValue'] as const;

  for (const field of fields) {
    const q = query(
      colRef,
      where('deletedAt', '==', null),
      where(field, '==', code),
      limit(1),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as Extinguisher;
    }
  }
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
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Extinguisher[];
}

/**
 * Subscribe to real-time updates for the extinguisher list.
 */
export function subscribeToExtinguishers(
  orgId: string,
  callback: (items: Extinguisher[]) => void,
  options: { showDeleted?: boolean; noLimit?: boolean } = {},
): () => void {
  const constraints: QueryConstraint[] = [];

  if (options.showDeleted) {
    constraints.push(where('deletedAt', '!=', null));
  } else {
    constraints.push(where('deletedAt', '==', null));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  if (!options.noLimit) {
    constraints.push(limit(100));
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
