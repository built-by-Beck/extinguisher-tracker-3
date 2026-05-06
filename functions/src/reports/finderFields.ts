import type { DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';

export interface FinderFieldRow {
  extinguisherId?: string;
  assetId: string;
  serial: string;
  parentLocation: string;
  locationName: string;
  section: string;
  vicinity: string;
  manufactureYear: number | null;
  expirationYear: number | null;
  isExpired: boolean;
  lifecycleStatus: string | null;
  complianceStatus: string | null;
}

export interface InspectionResultSource {
  extinguisherId?: unknown;
  assetId?: unknown;
  serial?: unknown;
  parentLocation?: unknown;
  locationName?: unknown;
  section?: unknown;
  vicinity?: unknown;
  manufactureYear?: unknown;
  expirationYear?: unknown;
  isExpired?: unknown;
  lifecycleStatus?: unknown;
  complianceStatus?: unknown;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function boolOrFalse(value: unknown): boolean {
  return value === true;
}

function toFinderFieldRow(data: InspectionResultSource): FinderFieldRow {
  return {
    extinguisherId: stringOrEmpty(data.extinguisherId),
    assetId: stringOrEmpty(data.assetId),
    serial: stringOrEmpty(data.serial),
    parentLocation: stringOrEmpty(data.parentLocation),
    locationName: stringOrEmpty(data.locationName),
    section: stringOrEmpty(data.section),
    vicinity: stringOrEmpty(data.vicinity),
    manufactureYear: numberOrNull(data.manufactureYear),
    expirationYear: numberOrNull(data.expirationYear),
    isExpired: boolOrFalse(data.isExpired),
    lifecycleStatus: stringOrEmpty(data.lifecycleStatus) || null,
    complianceStatus: stringOrEmpty(data.complianceStatus) || null,
  };
}

function mergeFinderFields(
  row: FinderFieldRow,
  extinguisher: DocumentData | undefined,
): FinderFieldRow {
  if (!extinguisher) return row;
  return {
    ...row,
    serial: row.serial || stringOrEmpty(extinguisher.serial),
    parentLocation: row.parentLocation || stringOrEmpty(extinguisher.parentLocation),
    locationName: row.locationName || stringOrEmpty(extinguisher.locationName),
    section: row.section || stringOrEmpty(extinguisher.section),
    vicinity: row.vicinity || stringOrEmpty(extinguisher.vicinity),
    manufactureYear: row.manufactureYear ?? numberOrNull(extinguisher.manufactureYear),
    expirationYear: row.expirationYear ?? numberOrNull(extinguisher.expirationYear),
    isExpired: row.isExpired || boolOrFalse(extinguisher.isExpired),
    lifecycleStatus: row.lifecycleStatus || stringOrEmpty(extinguisher.lifecycleStatus) || null,
    complianceStatus: row.complianceStatus || stringOrEmpty(extinguisher.complianceStatus) || null,
  };
}

export async function enrichFinderFields<T extends InspectionResultSource>(
  orgId: string,
  rows: T[],
): Promise<Array<T & FinderFieldRow>> {
  const ids = Array.from(
    new Set(rows.map((row) => stringOrEmpty(row.extinguisherId)).filter(Boolean)),
  );
  const extinguisherById = new Map<string, DocumentData>();

  if (ids.length > 0) {
    const refs = ids.map((id) => adminDb.doc(`org/${orgId}/extinguishers/${id}`));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap, index) => {
      if (snap.exists) {
        extinguisherById.set(ids[index], snap.data() ?? {});
      }
    });
  }

  return rows.map((row) => ({
    ...row,
    ...mergeFinderFields(toFinderFieldRow(row), extinguisherById.get(stringOrEmpty(row.extinguisherId))),
  }));
}

export function hasFinderFields(rows: InspectionResultSource[] | undefined): boolean {
  return Array.isArray(rows) && rows.every((row) => (
    'serial' in row &&
    'parentLocation' in row &&
    'locationName' in row &&
    'vicinity' in row &&
    'manufactureYear' in row &&
    'isExpired' in row
  ));
}
