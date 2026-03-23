import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { FieldValue } from 'firebase-admin/firestore';

export const resetInspection = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, inspectionId } = request.data as { orgId: string; inspectionId: string };

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!inspectionId || typeof inspectionId !== 'string') throwInvalidArgument('inspectionId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  return await adminDb.runTransaction(async (tx) => {
    // 1. Subscription check
    await validateSubscriptionTx(tx, orgId);

    // 2. Load required data
    const inspRef = adminDb.doc(`org/${orgId}/inspections/${inspectionId}`);
    const inspSnap = await tx.get(inspRef);
    if (!inspSnap.exists) throwNotFound('Inspection not found.');

    const inspData = inspSnap.data()!;
    const previousStatus = inspData.status as string;

    const wsRef = adminDb.doc(`org/${orgId}/workspaces/${inspData.workspaceId}`);
    const wsSnap = await tx.get(wsRef);

    // 3. Validation
    if (previousStatus === 'pending') {
      throwFailedPrecondition('Inspection is already pending.');
    }

    if (wsSnap.exists && wsSnap.data()?.status === 'archived') {
      throwFailedPrecondition('Cannot reset inspections in an archived workspace.');
    }

    const serverTimestamp = FieldValue.serverTimestamp();

    // 4. Apply updates
    tx.update(inspRef, {
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
      updatedAt: serverTimestamp,
    });

    // Create immutable event
    const eventRef = adminDb.collection(`org/${orgId}/inspectionEvents`).doc();
    tx.set(eventRef, {
      inspectionId,
      extinguisherId: inspData.extinguisherId,
      workspaceId: inspData.workspaceId,
      assetId: inspData.assetId,
      action: 'reset_to_pending',
      previousStatus,
      newStatus: 'pending',
      checklistData: null,
      notes: null,
      photoUrl: null,
      gps: null,
      attestation: null,
      performedBy: uid,
      performedByEmail: email,
      performedAt: serverTimestamp,
    });

    // Update workspace stats
    if (wsSnap.exists) {
      const statsUpdate: Record<string, unknown> = {
        'stats.lastUpdated': serverTimestamp,
        'stats.pending': FieldValue.increment(1),
      };
      if (previousStatus === 'pass') statsUpdate['stats.passed'] = FieldValue.increment(-1);
      else if (previousStatus === 'fail') statsUpdate['stats.failed'] = FieldValue.increment(-1);
      
      tx.update(wsRef, statsUpdate);
    }

    return { inspectionId, previousStatus };
  });
});

