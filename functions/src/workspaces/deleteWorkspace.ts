import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';

export const deleteWorkspace = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, workspaceId } = request.data as {
    orgId: string;
    workspaceId: string;
  };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }
  if (!workspaceId || typeof workspaceId !== 'string') {
    throwInvalidArgument('workspaceId is required.');
  }

  // Must be owner or admin to delete a workspace
  await validateMembership(orgId, uid, ['owner', 'admin']);

  const wsRef = adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`);
  const wsSnap = await wsRef.get();

  if (!wsSnap.exists) {
    throwNotFound('Workspace not found.');
  }

  // Delete all inspection documents linked to this workspace
  const inspSnap = await adminDb.collection(`org/${orgId}/inspections`)
    .where('workspaceId', '==', workspaceId)
    .get();

  if (!inspSnap.empty) {
    let batch = adminDb.batch();
    let batchCount = 0;
    for (const doc of inspSnap.docs) {
      batch.delete(doc.ref);
      batchCount++;
      if (batchCount >= 499) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
    }
  }

  // Delete the workspace document (and any subcollections)
  await adminDb.recursiveDelete(wsRef);

  // Also delete the associated report, if any
  const reportRef = adminDb.doc(`org/${orgId}/reports/${workspaceId}`);
  await reportRef.delete();

  // Audit log
  await writeAuditLog(orgId, {
    action: 'workspace.deleted',
    performedBy: uid,
    performedByEmail: email,
    entityType: 'workspace',
    entityId: workspaceId,
    details: { workspaceId, label: wsSnap.data()?.label },
  });

  return { success: true, workspaceId };
});
