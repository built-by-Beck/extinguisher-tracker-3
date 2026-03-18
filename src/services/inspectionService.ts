import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';

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
