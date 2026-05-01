import { FieldValue } from 'firebase-admin/firestore';

export interface ExtinguisherInspectionSource {
  assetId?: unknown;
  parentLocation?: unknown;
  section?: unknown;
  serial?: unknown;
  locationId?: unknown;
  deletedAt?: unknown;
  category?: unknown;
  lifecycleStatus?: unknown;
  status?: unknown;
  isActive?: unknown;
}

export interface ExtinguisherInspectionSeed {
  targetType: 'extinguisher';
  extinguisherId: string;
  workspaceId: string;
  assetId: string;
  parentLocation: string;
  section: string;
  serial: string;
  locationId: string | null;
  status: 'pending';
  isExpired: false;
  inspectedAt: null;
  inspectedBy: null;
  inspectedByEmail: null;
  checklistData: null;
  notes: string;
  photoUrl: null;
  photoPath: null;
  gps: null;
  attestation: null;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function deterministicExtinguisherInspectionId(extinguisherId: string, workspaceId: string): string {
  return `ext_${extinguisherId}_${workspaceId}`;
}

export function isMonthlyWorkspaceExtinguisher(data: ExtinguisherInspectionSource): boolean {
  const lifecycleStatus = typeof data.lifecycleStatus === 'string' ? data.lifecycleStatus : null;
  const category = typeof data.category === 'string' ? data.category : null;
  const status = typeof data.status === 'string' ? data.status : null;

  if (data.deletedAt != null) return false;
  if (category !== 'standard') return false;
  if (lifecycleStatus === 'replaced' || lifecycleStatus === 'retired' || lifecycleStatus === 'deleted') return false;
  if (status != null && status !== 'active') return false;
  if (data.isActive === false) return false;

  return lifecycleStatus === 'active' || lifecycleStatus == null || lifecycleStatus === '';
}

export function buildPendingExtinguisherInspectionSeed(
  extinguisherId: string,
  workspaceId: string,
  data: ExtinguisherInspectionSource,
  timestamp: FieldValue = FieldValue.serverTimestamp(),
): ExtinguisherInspectionSeed {
  return {
    targetType: 'extinguisher',
    extinguisherId,
    workspaceId,
    assetId: stringOrEmpty(data.assetId),
    parentLocation: stringOrEmpty(data.parentLocation),
    section: stringOrEmpty(data.section),
    serial: stringOrEmpty(data.serial),
    locationId: stringOrNull(data.locationId),
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
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
