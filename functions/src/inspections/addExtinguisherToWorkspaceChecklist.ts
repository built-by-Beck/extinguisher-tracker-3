import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscription, validateSubscriptionTx } from '../utils/subscription.js';
import { throwFailedPrecondition, throwInvalidArgument, throwNotFound } from '../utils/errors.js';
import {
  buildPendingExtinguisherInspectionSeed,
  deterministicExtinguisherInspectionId,
  isMonthlyWorkspaceExtinguisher,
} from './extinguisherInspectionRows.js';

interface AddExtinguisherToWorkspaceChecklistData {
  orgId: string;
  workspaceId: string;
  extinguisherId: string;
}

export const addExtinguisherToWorkspaceChecklist = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, workspaceId, extinguisherId } = request.data as AddExtinguisherToWorkspaceChecklistData;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!workspaceId || typeof workspaceId !== 'string') throwInvalidArgument('workspaceId is required.');
  if (!extinguisherId || typeof extinguisherId !== 'string') {
    throwInvalidArgument('extinguisherId is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);
  await validateSubscription(orgId);

  const wsSnap = await adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`).get();
  if (!wsSnap.exists) throwNotFound('Workspace not found.');
  if (wsSnap.data()?.status !== 'active') {
    throwFailedPrecondition('Only active workspaces can receive new checklist items.');
  }

  const extSnap = await adminDb.doc(`org/${orgId}/extinguishers/${extinguisherId}`).get();
  if (!extSnap.exists) throwNotFound('Extinguisher not found.');
  if (!isMonthlyWorkspaceExtinguisher(extSnap.data()!)) {
    throwFailedPrecondition('Only active standard extinguishers can be added to the monthly checklist.');
  }

  const legacyExistingSnap = await adminDb.collection(`org/${orgId}/inspections`)
    .where('workspaceId', '==', workspaceId)
    .where('extinguisherId', '==', extinguisherId)
    .limit(1)
    .get();

  if (!legacyExistingSnap.empty) {
    return {
      inspectionId: legacyExistingSnap.docs[0].id,
      created: false,
      alreadyExisted: true,
    };
  }

  return await adminDb.runTransaction(async (tx) => {
    await validateSubscriptionTx(tx, orgId);

    const wsRef = adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`);
    const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extinguisherId}`);
    const inspectionId = deterministicExtinguisherInspectionId(extinguisherId, workspaceId);
    const inspRef = adminDb.doc(`org/${orgId}/inspections/${inspectionId}`);

    const [wsSnap, extSnap, inspSnap] = await Promise.all([
      tx.get(wsRef),
      tx.get(extRef),
      tx.get(inspRef),
    ]);

    if (!wsSnap.exists) throwNotFound('Workspace not found.');
    if (wsSnap.data()?.status !== 'active') {
      throwFailedPrecondition('Only active workspaces can receive new checklist items.');
    }
    if (!extSnap.exists) throwNotFound('Extinguisher not found.');

    const extData = extSnap.data()!;
    if (!isMonthlyWorkspaceExtinguisher(extData)) {
      throwFailedPrecondition('Only active standard extinguishers can be added to the monthly checklist.');
    }

    if (inspSnap.exists) {
      return {
        inspectionId,
        created: false,
        alreadyExisted: true,
      };
    }

    const serverTimestamp = FieldValue.serverTimestamp();
    tx.set(
      inspRef,
      buildPendingExtinguisherInspectionSeed(extinguisherId, workspaceId, extData, serverTimestamp),
    );
    tx.update(wsRef, {
      'stats.total': FieldValue.increment(1),
      'stats.pending': FieldValue.increment(1),
      'stats.lastUpdated': serverTimestamp,
    });

    return {
      inspectionId,
      created: true,
      alreadyExisted: false,
    };
  });
});
