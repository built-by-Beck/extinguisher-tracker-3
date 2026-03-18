import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { FieldValue } from 'firebase-admin/firestore';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatLabel(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  const monthIndex = parseInt(month, 10) - 1;
  return `${MONTH_LABELS[monthIndex]} '${year.slice(2)}`;
}

export const createWorkspace = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, monthYear } = request.data as { orgId: string; monthYear: string };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }
  if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
    throwInvalidArgument('monthYear must be in YYYY-MM format.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);

  // Check org has active subscription
  const orgRef = adminDb.doc(`org/${orgId}`);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throwInvalidArgument('Organization not found.');
  const orgData = orgSnap.data()!;
  const subStatus = orgData.subscriptionStatus as string | null;
  if (!subStatus || !['active', 'trialing'].includes(subStatus)) {
    throwFailedPrecondition('Active subscription required to create workspaces.');
  }

  // Check for duplicate workspace
  const wsRef = adminDb.doc(`org/${orgId}/workspaces/${monthYear}`);
  const wsSnap = await wsRef.get();
  if (wsSnap.exists) {
    throwFailedPrecondition(`Workspace for ${monthYear} already exists.`);
  }

  // Fetch all active extinguishers
  const extSnap = await adminDb.collection(`org/${orgId}/extinguishers`)
    .where('deletedAt', '==', null)
    .where('category', '==', 'standard')
    .get();

  const totalExtinguishers = extSnap.size;

  // Create workspace document
  await wsRef.set({
    label: formatLabel(monthYear),
    monthYear,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    archivedAt: null,
    archivedBy: null,
    stats: {
      total: totalExtinguishers,
      passed: 0,
      failed: 0,
      pending: totalExtinguishers,
      lastUpdated: FieldValue.serverTimestamp(),
    },
  });

  // Seed one inspection per active extinguisher (batch writes, 500 limit)
  const inspRef = adminDb.collection(`org/${orgId}/inspections`);
  let batch = adminDb.batch();
  let batchCount = 0;

  for (const extDoc of extSnap.docs) {
    const extData = extDoc.data();

    const inspDocRef = inspRef.doc();
    batch.set(inspDocRef, {
      extinguisherId: extDoc.id,
      workspaceId: monthYear,
      assetId: extData.assetId ?? '',
      section: extData.section ?? '',
      status: 'pending',
      inspectedAt: null,
      inspectedBy: null,
      inspectedByEmail: null,
      checklistData: null,
      notes: '',
      photoUrl: null,
      photoPath: null,
      gps: null,
      attestation: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batchCount++;

    // Commit every 499 and start a new batch
    if (batchCount >= 499) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  await writeAuditLog(orgId, {
    action: 'workspace.created',
    performedBy: uid,
    details: { monthYear, extinguishersSeeded: totalExtinguishers },
  });

  return { monthYear, label: formatLabel(monthYear), totalExtinguishers };
});
