/**
 * Cloud Function: retireExtinguisher
 * Permanently removes an extinguisher from service.
 * - Sets lifecycleStatus to 'retired'
 * - Clears all next* due date fields
 * - Writes audit log
 *
 * Callable by owner/admin.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, type DocumentReference, type DocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';

interface RetireExtinguisherInput {
  orgId: string;
  extinguisherId: string;
  reason: string;
}

export const retireExtinguisher = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, extinguisherId, reason } = request.data as RetireExtinguisherInput;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!extinguisherId || typeof extinguisherId !== 'string') throwInvalidArgument('extinguisherId is required.');
  if (!reason || typeof reason !== 'string') throwInvalidArgument('reason is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  return await adminDb.runTransaction(async (tx) => {
    // 1. Subscription check
    await validateSubscriptionTx(tx, orgId);

    // 2. Load extinguisher
    const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extinguisherId}`);
    const extSnap = await tx.get(extRef);
    if (!extSnap.exists) throwNotFound('Extinguisher not found.');

    const extData = extSnap.data()!;

    if (extData.lifecycleStatus === 'retired') {
      throwFailedPrecondition('Extinguisher is already retired.');
    }

    const inspectionSnap = await tx.get(
      adminDb.collection(`org/${orgId}/inspections`).where('extinguisherId', '==', extinguisherId),
    );
    const workspaceRefsById = new Map<string, DocumentReference>();
    for (const inspectionDoc of inspectionSnap.docs) {
      const workspaceId = inspectionDoc.data().workspaceId;
      if (typeof workspaceId === 'string' && workspaceId) {
        workspaceRefsById.set(workspaceId, adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`));
      }
    }
    const workspaceSnapsById = new Map<string, DocumentSnapshot>();
    for (const [workspaceId, workspaceRef] of workspaceRefsById) {
      workspaceSnapsById.set(workspaceId, await tx.get(workspaceRef));
    }

    const serverTimestamp = FieldValue.serverTimestamp();

    // 3. Apply updates
    tx.update(extRef, {
      lifecycleStatus: 'retired',
      status: 'retired',
      isActive: false,
      complianceStatus: 'retired',
      // Clear all next* due date fields — lifecycle tracking stops
      nextMonthlyInspection: null,
      nextAnnualInspection: null,
      nextSixYearMaintenance: null,
      nextHydroTest: null,
      overdueFlags: [],
      retiredAt: serverTimestamp,
      retiredBy: uid,
      retirementReason: reason,
      updatedAt: serverTimestamp,
    });

    const inspectionsByActiveWorkspace = new Map<string, { status: string }[]>();
    for (const inspectionDoc of inspectionSnap.docs) {
      const data = inspectionDoc.data();
      const workspaceId = data.workspaceId;
      if (typeof workspaceId === 'string' && workspaceSnapsById.get(workspaceId)?.data()?.status === 'active') {
        const rows = inspectionsByActiveWorkspace.get(workspaceId) ?? [];
        rows.push({ status: typeof data.status === 'string' ? data.status : 'pending' });
        inspectionsByActiveWorkspace.set(workspaceId, rows);
      }
      tx.delete(inspectionDoc.ref);
    }

    for (const [workspaceId, rows] of inspectionsByActiveWorkspace) {
      const wsRef = workspaceRefsById.get(workspaceId);
      if (!wsRef) continue;
      const wsData = workspaceSnapsById.get(workspaceId)?.data();
      const hasStoredReplacedCount =
        typeof (wsData?.stats as { replaced?: unknown } | undefined)?.replaced === 'number';
      const statsUpdate: Record<string, unknown> = {
        'stats.total': FieldValue.increment(-rows.length),
        'stats.lastUpdated': serverTimestamp,
      };
      const passCount = rows.filter((row) => row.status === 'pass').length;
      const failCount = rows.filter((row) => row.status === 'fail').length;
      const replacedCount = rows.filter((row) => row.status === 'replaced').length;
      const pendingCount = rows.length - passCount - failCount - replacedCount;
      if (passCount > 0) statsUpdate['stats.passed'] = FieldValue.increment(-passCount);
      if (failCount > 0) statsUpdate['stats.failed'] = FieldValue.increment(-failCount);
      if (pendingCount > 0) statsUpdate['stats.pending'] = FieldValue.increment(-pendingCount);
      if (replacedCount > 0 && hasStoredReplacedCount) {
        statsUpdate['stats.replaced'] = FieldValue.increment(-replacedCount);
      }
      tx.update(wsRef, statsUpdate);
    }

    // 4. Write audit log within transaction
    writeAuditLogTx(tx, orgId, {
      action: 'extinguisher.retired',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'extinguisher',
      entityId: extinguisherId,
      details: {
        extinguisherId,
        assetId: extData.assetId,
        reason,
      },
    });

    return { extinguisherId, lifecycleStatus: 'retired' };
  });
});

