import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { Location } from './locationService.ts';

export type CustomAssetStatus = 'active' | 'inactive' | 'retired' | 'out_of_service';
export type CustomAssetRecurrence = 'monthly' | 'weekly' | 'quarterly' | 'annual' | 'custom';
export type CustomAssetInspectionResult = 'pass' | 'fail' | 'na' | 'unchecked';

export interface CustomAssetInspectionItem {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  order: number;
  active: boolean;
}

export interface CustomAsset {
  id?: string;
  orgId: string;
  name: string;
  assetType?: string;
  assetCode?: string;
  barcode?: string;
  serialNumber?: string;
  locationId?: string;
  locationName?: string;
  notes?: string;
  details?: string;
  active: boolean;
  status: CustomAssetStatus;
  recurrence: CustomAssetRecurrence;
  // Future: allow orgs to create reusable inspection templates and apply them to custom assets.
  templateId?: string | null;
  inspectionItems: CustomAssetInspectionItem[];
  createdAt: Timestamp | unknown;
  createdBy: string;
  updatedAt: Timestamp | unknown;
  updatedBy: string;
  retiredAt?: Timestamp | unknown | null;
  retiredBy?: string | null;
}

export interface ChecklistAnswer {
  result: CustomAssetInspectionResult;
  notes?: string;
  answeredAt?: unknown;
  answeredBy?: string;
}

export interface CreateAssetInput {
  name: string;
  assetType?: string;
  assetCode?: string;
  barcode?: string;
  serialNumber?: string;
  locationId?: string | null;
  locationName?: string | null;
  notes?: string;
  details?: string;
  recurrence?: CustomAssetRecurrence;
  inspectionItems: CustomAssetInspectionItem[];
}

export interface ListAssetsFilters {
  activeOnly?: boolean;
  status?: CustomAssetStatus;
  locationId?: string | null;
}

function assetsRef(orgId: string) {
  return collection(db, 'org', orgId, 'assets');
}

function inspectionsRef(orgId: string) {
  return collection(db, 'org', orgId, 'inspections');
}

export function createInspectionItem(label: string, order: number): CustomAssetInspectionItem {
  return {
    id: crypto.randomUUID(),
    label: label.trim(),
    order,
    active: true,
    required: false,
  };
}

function normalizeAssetInput(orgId: string, uid: string, input: CreateAssetInput) {
  return {
    orgId,
    name: input.name.trim(),
    assetType: input.assetType?.trim() || '',
    assetCode: input.assetCode?.trim() || '',
    barcode: input.barcode?.trim() || '',
    serialNumber: input.serialNumber?.trim() || '',
    locationId: input.locationId || '',
    locationName: input.locationName || '',
    notes: input.notes?.trim() || '',
    details: input.details?.trim() || '',
    active: true,
    status: 'active' as CustomAssetStatus,
    recurrence: input.recurrence ?? 'monthly',
    templateId: null,
    inspectionItems: input.inspectionItems
      .filter((item) => item.label.trim())
      .map((item, index) => ({
        id: item.id || crypto.randomUUID(),
        label: item.label.trim(),
        description: item.description?.trim() || '',
        required: item.required ?? false,
        order: index,
        active: item.active !== false,
      })),
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    retiredAt: null,
    retiredBy: null,
  };
}

export async function createAsset(orgId: string, uid: string, input: CreateAssetInput): Promise<string> {
  const ref = doc(assetsRef(orgId));
  await setDoc(ref, normalizeAssetInput(orgId, uid, input));
  return ref.id;
}

export async function updateAsset(
  orgId: string,
  assetId: string,
  uid: string,
  updates: Partial<CreateAssetInput> & { active?: boolean; status?: CustomAssetStatus },
): Promise<void> {
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };

  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.assetType !== undefined) patch.assetType = updates.assetType.trim();
  if (updates.assetCode !== undefined) patch.assetCode = updates.assetCode.trim();
  if (updates.barcode !== undefined) patch.barcode = updates.barcode.trim();
  if (updates.serialNumber !== undefined) patch.serialNumber = updates.serialNumber.trim();
  if (updates.locationId !== undefined) patch.locationId = updates.locationId || '';
  if (updates.locationName !== undefined) patch.locationName = updates.locationName || '';
  if (updates.notes !== undefined) patch.notes = updates.notes.trim();
  if (updates.details !== undefined) patch.details = updates.details.trim();
  if (updates.recurrence !== undefined) patch.recurrence = updates.recurrence;
  if (updates.active !== undefined) patch.active = updates.active;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.inspectionItems !== undefined) {
    patch.inspectionItems = updates.inspectionItems
      .filter((item) => item.label.trim())
      .map((item, index) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        label: item.label.trim(),
        description: item.description?.trim() || '',
        order: index,
        active: item.active !== false,
      }));
  }

  await updateDoc(doc(db, 'org', orgId, 'assets', assetId), patch);
}

export async function retireAsset(orgId: string, assetId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'org', orgId, 'assets', assetId), {
    active: false,
    status: 'retired',
    retiredAt: serverTimestamp(),
    retiredBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function getAsset(orgId: string, assetId: string): Promise<CustomAsset | null> {
  const snap = await getDoc(doc(db, 'org', orgId, 'assets', assetId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CustomAsset;
}

function assetConstraints(filters: ListAssetsFilters = {}): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (filters.activeOnly) constraints.push(where('active', '==', true));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.locationId) constraints.push(where('locationId', '==', filters.locationId));
  constraints.push(orderBy('name', 'asc'));
  return constraints;
}

export async function listAssets(orgId: string, filters: ListAssetsFilters = {}): Promise<CustomAsset[]> {
  const snap = await getDocs(query(assetsRef(orgId), ...assetConstraints(filters)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomAsset));
}

export function listenToAssets(
  orgId: string,
  callback: (items: CustomAsset[]) => void,
  filters: ListAssetsFilters = {},
): () => void {
  return onSnapshot(query(assetsRef(orgId), ...assetConstraints(filters)), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomAsset)));
  });
}

export function getLocationName(locations: Location[], locationId: string | null | undefined): string {
  if (!locationId) return '';
  return locations.find((loc) => loc.id === locationId)?.name ?? '';
}

export async function ensureCustomAssetInspectionForWorkspace(
  orgId: string,
  workspaceId: string,
  assetId: string,
): Promise<string> {
  const deterministicId = `asset_${assetId}_${workspaceId}`;
  const inspectionDoc = doc(db, 'org', orgId, 'inspections', deterministicId);
  const assetDoc = doc(db, 'org', orgId, 'assets', assetId);
  const workspaceDoc = doc(db, 'org', orgId, 'workspaces', workspaceId);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(inspectionDoc);
    if (existing.exists()) return;

    const [assetSnap, workspaceSnap] = await Promise.all([tx.get(assetDoc), tx.get(workspaceDoc)]);
    if (!assetSnap.exists()) throw new Error('Custom asset not found.');
    if (!workspaceSnap.exists()) throw new Error('Inspection workspace not found.');

    const asset = { id: assetSnap.id, ...assetSnap.data() } as CustomAsset;
    if (!asset.active || asset.status !== 'active' || asset.recurrence !== 'monthly') {
      throw new Error('Only active monthly custom assets can be added to the current workspace.');
    }

    const checklistSnapshot = [...asset.inspectionItems]
      .filter((item) => item.active)
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({ ...item, order: index }));

    tx.set(inspectionDoc, {
      orgId,
      workspaceId,
      targetType: 'asset',
      assetRefId: assetId,
      assetName: asset.name,
      assetType: asset.assetType ?? '',
      assetCode: asset.assetCode ?? '',
      assetId: asset.assetCode || asset.name,
      locationId: asset.locationId || null,
      locationName: asset.locationName || '',
      section: asset.locationName || '',
      status: 'pending',
      inspectedAt: null,
      inspectedBy: null,
      inspectedByEmail: null,
      notes: '',
      details: '',
      photoUrl: null,
      photoPath: null,
      gps: null,
      attestation: null,
      checklistSnapshot,
      checklistAnswers: Object.fromEntries(
        checklistSnapshot.map((item) => [item.id, { result: 'unchecked' }]),
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.update(workspaceDoc, {
      'stats.total': (workspaceSnap.data()?.stats?.total ?? 0) + 1,
      'stats.pending': (workspaceSnap.data()?.stats?.pending ?? 0) + 1,
      'stats.lastUpdated': serverTimestamp(),
    });
  });

  return deterministicId;
}

export function listenToAssetInspectionHistory(
  orgId: string,
  assetId: string,
  callback: (items: Array<Record<string, unknown>>) => void,
): () => void {
  const q = query(
    inspectionsRef(orgId),
    where('targetType', '==', 'asset'),
    where('assetRefId', '==', assetId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
