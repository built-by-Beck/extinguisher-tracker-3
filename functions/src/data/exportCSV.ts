import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { getStorage } from 'firebase-admin/storage';

const CSV_HEADERS = [
  'assetId',
  'serial',
  'barcode',
  'manufacturer',
  'extinguisherType',
  'serviceClass',
  'extinguisherSize',
  'category',
  'section',
  'vicinity',
  'parentLocation',
  'locationId',
  'manufactureYear',
  'expirationYear',
  'lifecycleStatus',
  'complianceStatus',
  'createdAt',
  'lastMonthlyInspection',
  'lastAnnualInspection',
];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function timestampToString(ts: unknown): string {
  if (!ts) return '';
  // Firestore Timestamp has toDate()
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (ts instanceof Date) {
    return ts.toISOString();
  }
  return '';
}

export const exportExtinguishersCSV = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId } = request.data as { orgId: string };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }

  // Any active member can export
  await validateMembership(orgId, uid, ['owner', 'admin', 'inspector', 'viewer']);

  // Fetch all active extinguishers
  const extRef = adminDb.collection(`org/${orgId}/extinguishers`);
  const snapshot = await extRef.where('deletedAt', '==', null).orderBy('assetId').get();

  // Build CSV content
  const lines: string[] = [CSV_HEADERS.join(',')];

  snapshot.forEach((doc) => {
    const d = doc.data();
    const row = [
      escapeCSV(d.assetId),
      escapeCSV(d.serial),
      escapeCSV(d.barcode),
      escapeCSV(d.manufacturer),
      escapeCSV(d.extinguisherType),
      escapeCSV(d.serviceClass),
      escapeCSV(d.extinguisherSize),
      escapeCSV(d.category),
      escapeCSV(d.section),
      escapeCSV(d.vicinity),
      escapeCSV(d.parentLocation),
      escapeCSV(d.locationId),
      escapeCSV(d.manufactureYear),
      escapeCSV(d.expirationYear),
      escapeCSV(d.lifecycleStatus),
      escapeCSV(d.complianceStatus),
      timestampToString(d.createdAt),
      timestampToString(d.lastMonthlyInspection),
      timestampToString(d.lastAnnualInspection),
    ];
    lines.push(row.join(','));
  });

  const csvContent = lines.join('\n');

  // Upload to Firebase Storage
  const bucket = getStorage().bucket();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `org/${orgId}/exports/${timestamp}_extinguishers.csv`;
  const file = bucket.file(filePath);

  await file.save(csvContent, {
    contentType: 'text/csv',
    metadata: { cacheControl: 'private, max-age=3600' },
  });

  // Generate a signed download URL (expires in 1 hour)
  const [downloadUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });

  await writeAuditLog(orgId, {
    action: 'data.exported',
    performedBy: uid,
    entityType: 'data',
    entityId: orgId,
    details: { rowCount: snapshot.size, filePath },
  });

  return { downloadUrl, rowCount: snapshot.size };
});
