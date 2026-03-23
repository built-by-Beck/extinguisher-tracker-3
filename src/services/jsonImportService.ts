import { writeBatch, doc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { type Extinguisher } from './extinguisherService.ts';

/** Shape of a single extinguisher in a JSON backup file */
export interface BackupExtinguisher {
  assetId?: string;
  serial?: string;
  barcode?: string;
  manufacturer?: string;
  category?: string;
  extinguisherType?: string;
  serviceClass?: string;
  extinguisherSize?: string;
  section?: string;
  vicinity?: string;
  parentLocation?: string;
  manufactureYear?: number;
  expirationYear?: number;
  // Old app fields that need mapping
  status?: string;          // old app field — maps to complianceStatus
  checkedDate?: string;     // old app field — maps to lastMonthlyInspection
  inspectionHistory?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  // Allow any other fields (we'll pick what we recognize)
  [key: string]: unknown;
}

/** Shape of the JSON backup file */
export interface BackupFile {
  collections?: {
    extinguishers?: BackupExtinguisher[];
    [key: string]: unknown;
  };
  // Also support flat format
  extinguishers?: BackupExtinguisher[];
  // Metadata
  date?: string;
  exportedBy?: string;
  totalItems?: number;
}

/** Result of validating a backup file */
export interface ValidationResult {
  valid: boolean;
  extinguishers: BackupExtinguisher[];
  errors: string[];
  warnings: string[];
}

/** Result of the import operation */
export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Parse and validate a JSON backup file.
 */
export function parseAndValidateBackup(jsonText: string): ValidationResult {
  const result: ValidationResult = {
    valid: false,
    extinguishers: [],
    errors: [],
    warnings: [],
  };

  try {
    const json = JSON.parse(jsonText);
    let rawList: any[] = [];

    if (Array.isArray(json)) {
      rawList = json;
    } else if (json.extinguishers && Array.isArray(json.extinguishers)) {
      rawList = json.extinguishers;
    } else if (json.collections?.extinguishers && Array.isArray(json.collections.extinguishers)) {
      rawList = json.collections.extinguishers;
    } else {
      result.errors.push('Could not find extinguishers array in JSON. Use standard backup format.');
      return result;
    }

    result.extinguishers = rawList.filter((item) => {
      if (!item.assetId && !item.serial) {
        result.warnings.push(`Skipping item missing both assetId and serial.`);
        return false;
      }
      return true;
    });

    if (result.extinguishers.length === 0) {
      result.errors.push('No valid extinguishers found in the file.');
    } else {
      result.valid = true;
    }
  } catch (err) {
    result.errors.push('Invalid JSON file format.');
  }

  return result;
}

/**
 * Map a BackupExtinguisher to EX3's Extinguisher shape.
 */
export function mapToExtinguisher(
  item: BackupExtinguisher,
  uid: string,
): Record<string, unknown> {
  const now = serverTimestamp();
  
  // Basic mapping
  return {
    assetId: item.assetId || `IMPORTED-${Date.now().toString(36).toUpperCase()}`,
    serial: item.serial || '',
    barcode: item.barcode || null,
    barcodeFormat: null,
    qrCodeValue: null,
    qrCodeUrl: null,
    manufacturer: item.manufacturer || null,
    category: item.category || 'standard',
    extinguisherType: item.extinguisherType || null,
    serviceClass: item.serviceClass || null,
    extinguisherSize: item.extinguisherSize || null,
    manufactureDate: null,
    manufactureYear: item.manufactureYear || null,
    installDate: null,
    inServiceDate: null,
    expirationYear: item.expirationYear || null,
    vicinity: item.vicinity || '',
    parentLocation: item.parentLocation || '',
    section: item.section || '',
    locationId: null,
    photos: item.photos || [],
    lastMonthlyInspection: item.checkedDate ? Timestamp.fromDate(new Date(item.checkedDate)) : null,
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
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
  };
}

import { Timestamp } from 'firebase/firestore';

/**
 * Import a validated list of extinguishers into Firestore.
 */
export async function importExtinguishers(
  orgId: string,
  uid: string,
  items: BackupExtinguisher[],
  assetLimit: number | null,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  // 1. Fetch existing assetIds to check for conflicts
  const extRef = collection(db, 'org', orgId, 'extinguishers');
  const existingSnap = await getDocs(query(extRef, where('deletedAt', '==', null)));
  const existingAssetIds = new Set(
    existingSnap.docs.map((d) => (d.data().assetId as string).trim().toLowerCase())
  );

  const currentCount = existingSnap.size;
  let toImport = items;

  // 2. Check asset limit
  if (assetLimit && currentCount + items.length > assetLimit) {
    const allowed = Math.max(0, assetLimit - currentCount);
    toImport = items.slice(0, allowed);
    result.skipped += (items.length - allowed);
    result.errors.push(`Some items skipped due to asset limit (${assetLimit}).`);
  }

  // 3. Batch create, skipping duplicates
  let batch = writeBatch(db);
  let opCount = 0;

  for (const item of toImport) {
    const assetId = (item.assetId ?? '').trim().toLowerCase();
    if (assetId && existingAssetIds.has(assetId)) {
      result.skipped++;
      continue;
    }

    const docRef = doc(extRef);
    const data = mapToExtinguisher(item, uid);
    batch.set(docRef, data);
    if (assetId) existingAssetIds.add(assetId);
    opCount++;
    result.created++;

    if (opCount >= 499) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  return result;
}
