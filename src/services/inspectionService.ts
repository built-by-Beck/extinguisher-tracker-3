import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';
import { queueInspection } from './offlineSyncService.ts';
import type { ChecklistAnswer, CustomAssetInspectionItem } from './assetService.ts';

export interface ChecklistData {
  pinPresent: string;
  tamperSealIntact: string;
  gaugeCorrectPressure: string;
  weightCorrect: string;
  noDamage: string;
  inDesignatedLocation: string;
  clearlyVisible: string;
  nearestUnder75ft: string;
  topUnder5ft: string;
  bottomOver4in: string;
  mountedSecurely: string;
  inspectionWithin30Days: string;
  tagSignedDated: string;
}

export const CHECKLIST_ITEMS: { key: keyof ChecklistData; label: string }[] = [
  { key: 'pinPresent', label: 'Safety pin present' },
  { key: 'tamperSealIntact', label: 'Tamper seal intact' },
  { key: 'gaugeCorrectPressure', label: 'Gauge shows correct pressure' },
  { key: 'weightCorrect', label: 'Weight is correct' },
  { key: 'noDamage', label: 'No physical damage' },
  { key: 'inDesignatedLocation', label: 'In designated location' },
  { key: 'clearlyVisible', label: 'Clearly visible / not obstructed' },
  { key: 'nearestUnder75ft', label: 'Nearest unit under 75 ft' },
  { key: 'topUnder5ft', label: 'Top under 5 ft height' },
  { key: 'bottomOver4in', label: 'Bottom over 4 in from floor' },
  { key: 'mountedSecurely', label: 'Mounted securely' },
  { key: 'inspectionWithin30Days', label: 'Inspection within 30 days' },
  { key: 'tagSignedDated', label: 'Tag signed and dated' },
];

export interface ChecklistSection {
  title: string;
  items: { key: keyof ChecklistData; label: string }[];
}

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: 'Basic Monthly Check',
    items: [
      { key: 'pinPresent', label: 'Safety pin present' },
      { key: 'tamperSealIntact', label: 'Tamper seal intact' },
      { key: 'gaugeCorrectPressure', label: 'Gauge shows correct pressure' },
      { key: 'weightCorrect', label: 'Weight is correct' },
      { key: 'noDamage', label: 'No physical damage' },
    ],
  },
  {
    title: 'Location & Accessibility',
    items: [
      { key: 'inDesignatedLocation', label: 'In designated location' },
      { key: 'clearlyVisible', label: 'Clearly visible / not obstructed' },
      { key: 'nearestUnder75ft', label: 'Nearest unit under 75 ft' },
    ],
  },
  {
    title: 'Mounting & Height',
    items: [
      { key: 'topUnder5ft', label: 'Top under 5 ft height' },
      { key: 'bottomOver4in', label: 'Bottom over 4 in from floor' },
      { key: 'mountedSecurely', label: 'Mounted securely' },
    ],
  },
  {
    title: 'Administrative',
    items: [
      { key: 'inspectionWithin30Days', label: 'Inspection within 30 days' },
      { key: 'tagSignedDated', label: 'Tag signed and dated' },
    ],
  },
];

export const EMPTY_CHECKLIST: ChecklistData = {
  pinPresent: 'n/a',
  tamperSealIntact: 'n/a',
  gaugeCorrectPressure: 'n/a',
  weightCorrect: 'n/a',
  noDamage: 'n/a',
  inDesignatedLocation: 'n/a',
  clearlyVisible: 'n/a',
  nearestUnder75ft: 'n/a',
  topUnder5ft: 'n/a',
  bottomOver4in: 'n/a',
  mountedSecurely: 'n/a',
  inspectionWithin30Days: 'n/a',
  tagSignedDated: 'n/a',
};

export interface Inspection {
  id?: string;
  targetType?: 'extinguisher' | 'asset';
  extinguisherId: string;
  workspaceId: string;
  assetId: string;
  assetRefId?: string;
  assetName?: string;
  assetType?: string;
  assetCode?: string;
  parentLocation?: string;
  section: string;
  serial?: string;
  locationId: string | null;
  locationName?: string;
  status: 'pending' | 'pass' | 'fail' | 'replaced' | string;
  isExpired?: boolean;
  inspectedAt: unknown | null;
  inspectedBy: string | null;
  inspectedByEmail: string | null;
  checklistData: ChecklistData | null;
  notes: string;
  details?: string;
  photoUrl: string | null;
  photoPath: string | null;
  gps: unknown | null;
  attestation: unknown | null;
  checklistSnapshot?: CustomAssetInspectionItem[];
  checklistAnswers?: Record<string, ChecklistAnswer>;
  createdAt: unknown;
  updatedAt: unknown;
}

/**
 * Subscribe to inspections for a workspace.
 */
export function subscribeToInspections(
  orgId: string,
  workspaceId: string,
  callback: (items: Inspection[]) => void,
  options: { section?: string; status?: string; includeAssetInspections?: boolean } = {},
): () => void {
  const constraints: QueryConstraint[] = [
    where('workspaceId', '==', workspaceId),
  ];

  if (options.section) {
    constraints.push(where('section', '==', options.section));
  }
  if (options.status) {
    constraints.push(where('status', '==', options.status));
  }

  constraints.push(orderBy('assetId', 'asc'));

  const q = query(collection(db, 'org', orgId, 'inspections'), ...constraints);

  return onSnapshot(q, (snap) => {
    const items: Inspection[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Inspection[];
    callback(options.includeAssetInspections ? items : items.filter((item) => item.targetType !== 'asset'));
  });
}

/**
 * Get a single inspection by ID.
 */
export async function getInspection(orgId: string, inspectionId: string): Promise<Inspection | null> {
  const ref = doc(db, 'org', orgId, 'inspections', inspectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Inspection;
}

/**
 * Save an inspection result via Cloud Function.
 */
export async function saveInspectionCall(
  orgId: string,
  inspectionId: string,
  data: {
    status: 'pass' | 'fail';
    isExpired?: boolean;
    checklistData?: ChecklistData;
    checklistAnswers?: Record<string, ChecklistAnswer>;
    notes?: string;
    details?: string;
    photoUrl?: string | null;
    photoPath?: string | null;
    gps?: unknown | null;
    attestation?: {
      confirmed: boolean;
      text: string;
      inspectorName: string;
    } | null;
  },
): Promise<{ inspectionId: string; status: string; previousStatus: string }> {
  const fn = httpsCallable<unknown, { inspectionId: string; status: string; previousStatus: string }>(
    functions,
    'saveInspection',
  );
  const result = await fn({ orgId, inspectionId, ...data });
  return result.data;
}

/**
 * Offline-aware inspection save.
 *
 * - If online: tries saveInspectionCall() directly.
 *   On network error (fetch failure), falls through to offline queue.
 * - If offline OR network error: queues via IndexedDB for later sync.
 *
 * Returns { synced: true } if saved directly, or { synced: false, queueId } if queued.
 */
export async function saveInspectionOfflineAware(
  orgId: string,
  inspectionId: string,
  extinguisherId: string,
  workspaceId: string,
  data: {
    status: 'pass' | 'fail';
    isExpired?: boolean;
    checklistData: ChecklistData;
    notes: string;
    photoUrl?: string | null;
    photoPath?: string | null;
    gps?: unknown | null;
    attestation: {
      confirmed: boolean;
      text: string;
      inspectorName: string;
    } | null;
  },
  isOnline: boolean,
): Promise<{ synced: boolean; queueId?: string }> {
  if (isOnline) {
    try {
      await saveInspectionCall(orgId, inspectionId, data);
      return { synced: true };
    } catch (err: unknown) {
      // Check if it's a network error (fetch failed) vs a server error
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isNetworkError =
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('failed to fetch') ||
        msg.includes('offline') ||
        msg.includes('internet');

      if (!isNetworkError) {
        // Re-throw server errors (permission denied, not-found, etc.)
        throw err;
      }
      // Fall through to queue on network error
    }
  }

  // Offline path: queue the inspection
  const queueId = await queueInspection({
    orgId,
    inspectionId,
    extinguisherId,
    workspaceId,
    status: data.status,
    isExpired: data.isExpired ?? false,
    checklistData: data.checklistData,
    notes: data.notes,
    photoUrl: data.photoUrl ?? null,
    photoPath: data.photoPath ?? null,
    gps: data.gps ?? null,
    attestation: data.attestation,
    queuedAt: Date.now(),
  });

  return { synced: false, queueId };
}

/**
 * Get the inspection for a specific extinguisher in a specific workspace.
 * Returns the first matching doc (pending, pass, or fail).
 */
export async function getInspectionForExtinguisherInWorkspace(
  orgId: string,
  extinguisherId: string,
  workspaceId: string,
): Promise<Inspection | null> {
  const q = query(
    collection(db, 'org', orgId, 'inspections'),
    where('extinguisherId', '==', extinguisherId),
    where('workspaceId', '==', workspaceId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Inspection;
}

export async function getInspectionForAssetInWorkspace(
  orgId: string,
  assetId: string,
  workspaceId: string,
): Promise<Inspection | null> {
  const deterministicId = `asset_${assetId}_${workspaceId}`;
  const ref = doc(db, 'org', orgId, 'inspections', deterministicId);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() } as Inspection;

  const q = query(
    collection(db, 'org', orgId, 'inspections'),
    where('targetType', '==', 'asset'),
    where('assetRefId', '==', assetId),
    where('workspaceId', '==', workspaceId),
    limit(1),
  );
  const querySnap = await getDocs(q);
  if (querySnap.empty) return null;
  return { id: querySnap.docs[0].id, ...querySnap.docs[0].data() } as Inspection;
}

/**
 * Get completed inspection history for an extinguisher across all workspaces.
 * Returns pass/fail inspections ordered by inspectedAt descending.
 */
export async function getInspectionHistoryForExtinguisher(
  orgId: string,
  extinguisherId: string,
  limitCount: number = 10,
): Promise<Inspection[]> {
  const q = query(
    collection(db, 'org', orgId, 'inspections'),
    where('extinguisherId', '==', extinguisherId),
    where('status', 'in', ['pass', 'fail']),
    orderBy('inspectedAt', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Inspection));
}

export async function getInspectionHistoryForAsset(
  orgId: string,
  assetId: string,
  limitCount: number = 12,
): Promise<Inspection[]> {
  const q = query(
    collection(db, 'org', orgId, 'inspections'),
    where('targetType', '==', 'asset'),
    where('assetRefId', '==', assetId),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Inspection));
}

/**
 * Create a single pending inspection for an extinguisher in a workspace.
 * Used when an extinguisher is opened for inspection but has no inspection
 * record yet (e.g., added after workspace creation).
 */
export async function createSingleInspection(
  orgId: string,
  extId: string,
  workspaceId: string,
  extData: {
    assetId: string;
    parentLocation?: string;
    section?: string;
    serial?: string;
    locationId?: string | null;
  },
): Promise<Inspection> {
  const inspData = {
    targetType: 'extinguisher',
    extinguisherId: extId,
    workspaceId,
    assetId: extData.assetId ?? '',
    parentLocation: extData.parentLocation ?? '',
    section: extData.section ?? '',
    serial: extData.serial ?? '',
    locationId: extData.locationId ?? null,
    status: 'pending',
    isExpired: false,
    inspectedAt: null,
    inspectedBy: null,
    inspectedByEmail: null,
    checklistData: null,
    notes: '',
    photoUrl: null,
    photoPath: null,
    gps: null,
    attestation: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'org', orgId, 'inspections'), inspData);

  // Update workspace stats to reflect the newly seeded inspection
  const wsRef = doc(db, 'org', orgId, 'workspaces', workspaceId);
  await updateDoc(wsRef, {
    'stats.total': increment(1),
    'stats.pending': increment(1),
    'stats.lastUpdated': serverTimestamp(),
  }).catch(() => {
    // Non-critical — stats will be recalculated on archive
  });

  return { id: ref.id, ...inspData } as Inspection;
}

/**
 * Reset an inspection to pending via Cloud Function.
 */
export async function resetInspectionCall(
  orgId: string,
  inspectionId: string,
): Promise<{ inspectionId: string; previousStatus: string }> {
  const fn = httpsCallable<
    { orgId: string; inspectionId: string },
    { inspectionId: string; previousStatus: string }
  >(functions, 'resetInspection');
  const result = await fn({ orgId, inspectionId });
  return result.data;
}
