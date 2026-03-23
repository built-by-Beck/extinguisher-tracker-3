import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';
import { FieldValue } from 'firebase-admin/firestore';

interface InspectionResultData {
  assetId: string;
  section: string;
  status: string;
  inspectedAt: unknown;
  inspectedBy: string | null;
  inspectedByEmail: string | null;
  notes: string;
  checklistData: Record<string, string> | null;
}

export const archiveWorkspace = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, workspaceId, sectionTimes } = request.data as {
    orgId: string;
    workspaceId: string;
    sectionTimes?: Record<string, number> | null;
  };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }
  if (!workspaceId || typeof workspaceId !== 'string') {
    throwInvalidArgument('workspaceId is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);

  // 1. Fetch inspections outside transaction (queries not allowed in tx)
  const inspSnap = await adminDb.collection(`org/${orgId}/inspections`)
    .where('workspaceId', '==', workspaceId)
    .get();

  let passed = 0;
  let failed = 0;
  let pending = 0;
  const results: InspectionResultData[] = [];

  inspSnap.forEach((d) => {
    const data = d.data();
    const status = data.status as string;
    if (status === 'pass') passed++;
    else if (status === 'fail') failed++;
    else pending++;

    results.push({
      assetId: data.assetId ?? '',
      section: data.section ?? '',
      status: data.status ?? 'pending',
      inspectedAt: data.inspectedAt ?? null,
      inspectedBy: data.inspectedBy ?? null,
      inspectedByEmail: data.inspectedByEmail ?? null,
      notes: data.notes ?? '',
      checklistData: data.checklistData ?? null,
    });
  });

  return await adminDb.runTransaction(async (tx) => {
    // 2. Subscription check
    await validateSubscriptionTx(tx, orgId);

    // 3. Load workspace
    const wsRef = adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`);
    const wsSnap = await tx.get(wsRef);

    if (!wsSnap.exists) {
      throwNotFound('Workspace not found.');
    }

    const wsData = wsSnap.data()!;
    if (wsData.status === 'archived') {
      throwFailedPrecondition('Workspace is already archived.');
    }

    const serverTimestamp = FieldValue.serverTimestamp();

    // 4. Update workspace
    tx.update(wsRef, {
      status: 'archived',
      archivedAt: serverTimestamp,
      archivedBy: uid,
      sectionTimes: sectionTimes ?? null,
      stats: {
        total: inspSnap.size,
        passed,
        failed,
        pending,
        lastUpdated: serverTimestamp,
      },
    });

    // 5. Create report snapshot
    const reportRef = adminDb.doc(`org/${orgId}/reports/${workspaceId}`);
    tx.set(reportRef, {
      workspaceId,
      monthYear: wsData.monthYear ?? '',
      label: wsData.label ?? '',
      archivedAt: serverTimestamp,
      archivedBy: uid,
      totalExtinguishers: inspSnap.size,
      passedCount: passed,
      failedCount: failed,
      pendingCount: pending,
      sectionTimes: sectionTimes ?? null,
      results, // NOTE: Limited to ~1000 items due to 1MB doc size
      csvDownloadUrl: null,
      csvFilePath: null,
      pdfDownloadUrl: null,
      pdfFilePath: null,
      jsonDownloadUrl: null,
      jsonFilePath: null,
      generatedAt: null,
    });

    // 6. Audit log
    writeAuditLogTx(tx, orgId, {
      action: 'workspace.archived',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'workspace',
      entityId: workspaceId,
      details: { workspaceId, total: inspSnap.size, passed, failed, pending },
    });

    return { workspaceId, passed, failed, pending };
  });
});

