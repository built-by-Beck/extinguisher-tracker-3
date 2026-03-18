import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { FieldValue } from 'firebase-admin/firestore';

export const archiveWorkspace = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, workspaceId } = request.data as { orgId: string; workspaceId: string };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }
  if (!workspaceId || typeof workspaceId !== 'string') {
    throwInvalidArgument('workspaceId is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const wsRef = adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`);
  const wsSnap = await wsRef.get();

  if (!wsSnap.exists) {
    throwNotFound('Workspace not found.');
  }

  const wsData = wsSnap.data()!;
  if (wsData.status === 'archived') {
    throwFailedPrecondition('Workspace is already archived.');
  }

  // Compute final stats
  const inspSnap = await adminDb.collection(`org/${orgId}/inspections`)
    .where('workspaceId', '==', workspaceId)
    .get();

  let passed = 0;
  let failed = 0;
  let pending = 0;

  inspSnap.forEach((doc) => {
    const status = doc.data().status as string;
    if (status === 'pass') passed++;
    else if (status === 'fail') failed++;
    else pending++;
  });

  await wsRef.update({
    status: 'archived',
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy: uid,
    stats: {
      total: inspSnap.size,
      passed,
      failed,
      pending,
      lastUpdated: FieldValue.serverTimestamp(),
    },
  });

  await writeAuditLog(orgId, {
    action: 'workspace.archived',
    performedBy: uid,
    details: { workspaceId, total: inspSnap.size, passed, failed, pending },
  });

  return { workspaceId, passed, failed, pending };
});
