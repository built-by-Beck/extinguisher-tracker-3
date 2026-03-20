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
  type QueryConstraint,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';
import { queueInspection } from './offlineSyncService.ts';

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
  extinguisherId: string;
  workspaceId: string;
  assetId: string;
  section: string;
  status: string; // pending, pass, fail
  inspectedAt: unknown | null;
  inspectedBy: string | null;
  inspectedByEmail: string | null;
  checklistData: ChecklistData | null;
  notes: string;
  photoUrl: string | null;
  photoPath: string | null;
  gps: unknown | null;
  attestation: unknown | null;
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
  options: { section?: string; status?: string } = {},
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
    callback(items);
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
    checklistData?: ChecklistData;
    notes?: string;
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
    checklistData: ChecklistData;
    notes: string;
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
    checklistData: data.checklistData,
    notes: data.notes,
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
