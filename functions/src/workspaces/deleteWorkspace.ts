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

  // Recursively delete the workspace and all its subcollections (like inspections)
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
