import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { type PlanName } from '../billing/planConfig.js';
import { FieldValue } from 'firebase-admin/firestore';

interface CSVRow {
  assetId: string;
  serial: string;
  barcode?: string;
  manufacturer?: string;
  extinguisherType?: string;
  serviceClass?: string;
  extinguisherSize?: string;
  category?: string;
  section?: string;
  vicinity?: string;
  parentLocation?: string;
  locationId?: string;
  manufactureYear?: string;
  expirationYear?: string;
}

function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });

    if (!row.assetId || !row.serial) continue; // skip rows missing required fields

    rows.push(row as unknown as CSVRow);
  }

  return rows;
}

export const importExtinguishersCSV = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, csvContent } = request.data as { orgId: string; csvContent: string };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }
  if (!csvContent || typeof csvContent !== 'string') {
    throwInvalidArgument('csvContent is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);

  // Check org subscription and asset limit
  const orgRef = adminDb.doc(`org/${orgId}`);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throwInvalidArgument('Organization not found.');
  }
  const orgData = orgSnap.data()!;
  const plan = orgData.plan as PlanName | null;
  const subscriptionStatus = orgData.subscriptionStatus as string | null;

  // Enterprise plans are managed manually — no Stripe subscription required
  if (plan !== 'enterprise' && !['active', 'trialing'].includes(subscriptionStatus ?? '')) {
    throwFailedPrecondition('Active subscription required to import extinguishers.');
  }

  // Bulk import is only available on Elite and Enterprise plans
  if (!plan || !['elite', 'enterprise'].includes(plan)) {
    throwFailedPrecondition('Bulk import is available on Elite and Enterprise plans only.');
  }

  const rows = parseCSV(csvContent);
  if (rows.length === 0) {
    throwInvalidArgument('CSV contains no valid rows. Ensure headers include assetId and serial.');
  }

  // Count existing active extinguishers
  const extRef = adminDb.collection(`org/${orgId}/extinguishers`);
  const activeQuery = extRef.where('deletedAt', '==', null);
  const activeSnap = await activeQuery.count().get();
  const currentCount = activeSnap.data().count;

  const assetLimit = orgData.assetLimit as number | null;
  if (assetLimit && currentCount + rows.length > assetLimit) {
    throwFailedPrecondition(
      `Import would exceed asset limit. Current: ${currentCount}, importing: ${rows.length}, limit: ${assetLimit}. ` +
      `You can import up to ${Math.max(0, assetLimit - currentCount)} more extinguishers.`,
    );
  }

  // Check for duplicate assetIds within the CSV
  const csvAssetIds = rows.map((r) => r.assetId);
  const duplicatesInCSV = csvAssetIds.filter((id, idx) => csvAssetIds.indexOf(id) !== idx);
  if (duplicatesInCSV.length > 0) {
    throwInvalidArgument(`Duplicate asset IDs in CSV: ${[...new Set(duplicatesInCSV)].join(', ')}`);
  }

  // Check for conflicts with existing assetIds
  const errors: string[] = [];
  const created: string[] = [];

  // Batch check existing assetIds (batches of 30 for Firestore 'in' query limit)
  const existingAssetIds = new Set<string>();
  for (let i = 0; i < csvAssetIds.length; i += 30) {
    const batch = csvAssetIds.slice(i, i + 30);
    const existingSnap = await extRef
      .where('assetId', 'in', batch)
      .where('deletedAt', '==', null)
      .get();
    existingSnap.forEach((doc) => {
      existingAssetIds.add(doc.data().assetId as string);
    });
  }

  // Create extinguishers in batches
  const writeBatch = adminDb.batch();
  let batchCount = 0;

  for (const row of rows) {
    if (existingAssetIds.has(row.assetId)) {
      errors.push(`Row skipped: assetId "${row.assetId}" already exists.`);
      continue;
    }

    const docRef = extRef.doc();
    writeBatch.set(docRef, {
      assetId: row.assetId,
      serial: row.serial,
      barcode: row.barcode || null,
      barcodeFormat: null,
      qrCodeValue: null,
      qrCodeUrl: null,
      manufacturer: row.manufacturer || null,
      category: row.category || 'standard',
      extinguisherType: row.extinguisherType || null,
      serviceClass: row.serviceClass || null,
      extinguisherSize: row.extinguisherSize || null,
      manufactureDate: null,
      manufactureYear: row.manufactureYear ? parseInt(row.manufactureYear, 10) : null,
      installDate: null,
      inServiceDate: null,
      expirationYear: row.expirationYear ? parseInt(row.expirationYear, 10) : null,
      vicinity: row.vicinity || '',
      parentLocation: row.parentLocation || '',
      section: row.section || '',
      locationId: row.locationId || null,
      photos: [],
      lastMonthlyInspection: null,
      nextMonthlyInspection: null,
      lastAnnualInspection: null,
      nextAnnualInspection: null,
      lastSixYearMaintenance: null,
      nextSixYearMaintenance: null,
      lastHydroTest: null,
      nextHydroTest: null,
      lifecycleStatus: 'active',
      complianceStatus: 'compliant',
      overdueFlags: [],
      replacedByExtId: null,
      replacesExtId: null,
      replacementHistory: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
    });

    created.push(row.assetId);
    batchCount++;

    // Firestore batch limit is 500
    if (batchCount >= 499) {
      break; // Safety limit — process in multiple calls for large imports
    }
  }

  if (batchCount > 0) {
    await writeBatch.commit();
  }

  await writeAuditLog(orgId, {
    action: 'data.imported',
    performedBy: uid,
    entityType: 'data',
    entityId: orgId,
    details: {
      totalRows: rows.length,
      created: created.length,
      skipped: errors.length,
      errors: errors.slice(0, 20), // Cap error reporting
    },
  });

  return {
    totalRows: rows.length,
    created: created.length,
    skipped: errors.length,
    errors,
  };
});
