import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
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
  const { uid } = validateAuth(request);
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

  await wsRef.update({
    status: 'archived',
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy: uid,
    sectionTimes: sectionTimes ?? null,
    stats: {
      total: inspSnap.size,
      passed,
      failed,
      pending,
      lastUpdated: FieldValue.serverTimestamp(),
    },
  });

  // Create report snapshot doc at org/{orgId}/reports/{workspaceId}
  // File exports (CSV/PDF/JSON) are generated on demand via the generateReport CF.
  const reportRef = adminDb.doc(`org/${orgId}/reports/${workspaceId}`);
  await reportRef.set({
    workspaceId,
    monthYear: wsData.monthYear ?? '',
    label: wsData.label ?? '',
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy: uid,
    totalExtinguishers: inspSnap.size,
    passedCount: passed,
    failedCount: failed,
    pendingCount: pending,
    sectionTimes: sectionTimes ?? null,
    results,
    csvDownloadUrl: null,
    csvFilePath: null,
    pdfDownloadUrl: null,
    pdfFilePath: null,
    jsonDownloadUrl: null,
    jsonFilePath: null,
    generatedAt: null,
  });

  await writeAuditLog(orgId, {
    action: 'workspace.archived',
    performedBy: uid,
    entityType: 'workspace',
    entityId: workspaceId,
    details: { workspaceId, total: inspSnap.size, passed, failed, pending },
  });

  return { workspaceId, passed, failed, pending };
});
