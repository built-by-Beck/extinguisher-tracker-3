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
}

export interface InspectionResultSource {
  extinguisherId?: unknown;
  assetId?: unknown;
  serial?: unknown;
  parentLocation?: unknown;
  locationName?: unknown;
  section?: unknown;
  vicinity?: unknown;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
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
    'vicinity' in row
  ));
}
