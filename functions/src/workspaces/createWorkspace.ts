import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import { throwInvalidArgument, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';
import { FieldValue } from 'firebase-admin/firestore';
import { canUseCustomAssetInspections } from '../billing/planConfig.js';
import {
  buildPendingExtinguisherInspectionSeed,
  deterministicExtinguisherInspectionId,
  isMonthlyWorkspaceExtinguisher,
} from '../inspections/extinguisherInspectionRows.js';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface AssetInspectionItemSnapshot {
  id: string;
  label?: string;
  description?: string;
  required?: boolean;
  active?: boolean;
  order: number;
}

function formatLabel(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  const monthIndex = parseInt(month, 10) - 1;
  return `${MONTH_LABELS[monthIndex]} '${year.slice(2)}`;
}

export const createWorkspace = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, monthYear } = request.data as { orgId: string; monthYear: string };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }
  if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
    throwInvalidArgument('monthYear must be in YYYY-MM format.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  const orgData = orgSnap.data() ?? {};
  const includeCustomAssets = canUseCustomAssetInspections(
    typeof orgData.plan === 'string' ? orgData.plan : null,
    (orgData.featureFlags as Record<string, boolean> | undefined) ?? null,
  );

  // 1. Check for active extinguishers outside transaction
  const extSnap = await adminDb.collection(`org/${orgId}/extinguishers`)
    .where('deletedAt', '==', null)
    .where('category', '==', 'standard')
    .get();

  const assetSnap = includeCustomAssets
    ? await adminDb.collection(`org/${orgId}/assets`)
      .where('active', '==', true)
      .where('status', '==', 'active')
      .where('recurrence', '==', 'monthly')
      .get()
    : null;

  const activeExtinguishers = extSnap.docs.filter((doc) => isMonthlyWorkspaceExtinguisher(doc.data()));
  const totalExtinguishers = activeExtinguishers.length;
  const totalCustomAssets = assetSnap?.size ?? 0;
  const totalInspectionTargets = totalExtinguishers + totalCustomAssets;

  // 2. Create workspace document within transaction
  await adminDb.runTransaction(async (tx) => {
    // Subscription check
    await validateSubscriptionTx(tx, orgId);

    // Duplicate check
    const wsRef = adminDb.doc(`org/${orgId}/workspaces/${monthYear}`);
    const wsSnap = await tx.get(wsRef);
    if (wsSnap.exists) {
      throwFailedPrecondition(`Workspace for ${monthYear} already exists.`);
    }

    const serverTimestamp = FieldValue.serverTimestamp();

    // Create workspace document
    tx.set(wsRef, {
      label: formatLabel(monthYear),
      monthYear,
      status: 'active',
      createdAt: serverTimestamp,
      createdBy: uid,
      archivedAt: null,
      archivedBy: null,
      stats: {
        total: totalInspectionTargets,
        passed: 0,
        failed: 0,
        pending: totalInspectionTargets,
        lastUpdated: serverTimestamp,
      },
    });

    // Write audit log within transaction
    writeAuditLogTx(tx, orgId, {
      action: 'workspace.created',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'workspace',
      entityId: monthYear,
      details: { monthYear, extinguishersSeeded: totalExtinguishers, customAssetsSeeded: totalCustomAssets },
    });
  });

  // 3. Seed inspections (Batches are okay here as the workspace is already created)
  const inspRef = adminDb.collection(`org/${orgId}/inspections`);
  let batch = adminDb.batch();
  let batchCount = 0;

  for (const extDoc of activeExtinguishers) {
    const extData = extDoc.data();
    const inspDocRef = inspRef.doc(deterministicExtinguisherInspectionId(extDoc.id, monthYear));
    
    batch.set(inspDocRef, buildPendingExtinguisherInspectionSeed(extDoc.id, monthYear, extData));

    batchCount++;
    if (batchCount >= 499) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  if (assetSnap) {
    for (const assetDoc of assetSnap.docs) {
      const assetData = assetDoc.data();
      const checklistSnapshot: AssetInspectionItemSnapshot[] = ((assetData.inspectionItems as Array<Record<string, unknown>> | undefined) ?? [])
        .filter((item) => item.active !== false)
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .map((item, index) => ({
          ...item,
          id: String(item.id ?? `item_${index}`),
          order: index,
        }));
      const inspDocRef = inspRef.doc(`asset_${assetDoc.id}_${monthYear}`);

      batch.set(inspDocRef, {
        orgId,
        workspaceId: monthYear,
        targetType: 'asset',
        assetRefId: assetDoc.id,
        assetName: assetData.name ?? '',
        assetType: assetData.assetType ?? '',
        assetCode: assetData.assetCode ?? '',
        assetId: assetData.assetCode || assetData.name || assetDoc.id,
        locationId: assetData.locationId || null,
        locationName: assetData.locationName ?? '',
        section: assetData.locationName ?? '',
        status: 'pending',
        inspectedAt: null,
        inspectedBy: null,
        inspectedByEmail: null,
        checklistSnapshot,
        checklistAnswers: Object.fromEntries(
          checklistSnapshot.map((item) => [String(item.id), { result: 'unchecked' }]),
        ),
        notes: '',
        details: '',
        photoUrl: null,
        photoPath: null,
        gps: null,
        attestation: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      batchCount++;
      if (batchCount >= 499) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  // 4. Clear non-carry-forward section notes
  const clearNotesSnap = await adminDb.collection(`org/${orgId}/sectionNotes`)
    .where('saveForNextMonth', '==', false)
    .get();

  if (!clearNotesSnap.empty) {
    let notesBatch = adminDb.batch();
    let notesCount = 0;
    for (const noteDoc of clearNotesSnap.docs) {
      notesBatch.update(noteDoc.ref, { notes: '' });
      notesCount++;
      if (notesCount >= 499) {
        await notesBatch.commit();
        notesBatch = adminDb.batch();
        notesCount = 0;
      }
    }
    if (notesCount > 0) await notesBatch.commit();
  }

  return { monthYear, label: formatLabel(monthYear), totalExtinguishers, totalCustomAssets };
});

