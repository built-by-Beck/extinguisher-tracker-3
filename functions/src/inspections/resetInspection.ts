import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { FieldValue } from 'firebase-admin/firestore';

export const resetInspection = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, inspectionId } = request.data as { orgId: string; inspectionId: string };

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!inspectionId || typeof inspectionId !== 'string') throwInvalidArgument('inspectionId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const inspRef = adminDb.doc(`org/${orgId}/inspections/${inspectionId}`);
  const inspSnap = await inspRef.get();
  if (!inspSnap.exists) throwNotFound('Inspection not found.');

  const inspData = inspSnap.data()!;
  const previousStatus = inspData.status as string;

  if (previousStatus === 'pending') {
    throwFailedPrecondition('Inspection is already pending.');
  }

  // Check workspace is not archived
  const wsRef = adminDb.doc(`org/${orgId}/workspaces/${inspData.workspaceId}`);
  const wsSnap = await wsRef.get();
  if (wsSnap.exists && wsSnap.data()?.status === 'archived') {
    throwFailedPrecondition('Cannot reset inspections in an archived workspace.');
  }

  // Reset to pending
  await inspRef.update({
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
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Create immutable event
  await adminDb.collection(`org/${orgId}/inspectionEvents`).add({
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
    performedAt: FieldValue.serverTimestamp(),
  });

  // Update workspace stats
  if (wsSnap.exists) {
    const statsUpdate: Record<string, unknown> = {
      'stats.lastUpdated': FieldValue.serverTimestamp(),
      'stats.pending': FieldValue.increment(1),
    };
    if (previousStatus === 'pass') statsUpdate['stats.passed'] = FieldValue.increment(-1);
    else if (previousStatus === 'fail') statsUpdate['stats.failed'] = FieldValue.increment(-1);
    await wsRef.update(statsUpdate);
  }

  return { inspectionId, previousStatus };
});
