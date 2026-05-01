/**
 * Callable: recompute active workspace stats from monthly inspection rows.
 * The pending checklist is the source of truth for active monthly work.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscription } from '../utils/subscription.js';
import { throwInvalidArgument, throwFailedPrecondition, throwNotFound } from '../utils/errors.js';

interface LooseInspection {
  id: string;
  targetType?: string;
  extinguisherId?: string;
  assetRefId?: string;
  status: string;
  updatedAt?: unknown;
  inspectedAt?: unknown;
  createdAt?: unknown;
}

interface BucketStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  percentage: number;
}

function firestoreLikeToMillis(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'object' && v !== null && 'toMillis' in v) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(v);
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    const s = (v as { seconds?: number }).seconds;
    if (typeof s === 'number') return s * 1000;
  }
  return 0;
}

function inspectionActivityMs(insp: LooseInspection): number {
  for (const v of [insp.updatedAt, insp.inspectedAt, insp.createdAt]) {
    const ms = firestoreLikeToMillis(v);
    if (ms > 0) return ms;
  }
  return 0;
}

function dedupeInspectionsByExtinguisherLatest(inspections: LooseInspection[]): LooseInspection[] {
  const sorted = [...inspections].sort((a, b) => inspectionActivityMs(b) - inspectionActivityMs(a));
  const seen = new Set<string>();
  const out: LooseInspection[] = [];
  for (const insp of sorted) {
    const key = inspectionIdentity(insp);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(insp);
  }
  return out;
}

function inspectionIdentity(insp: LooseInspection): string {
  if (insp.targetType === 'asset') return `asset:${insp.assetRefId || insp.id}`;
  return `ext:${insp.extinguisherId || insp.id}`;
}

function calculateStatsFromInspectionRows(inspections: LooseInspection[]): BucketStats {
  const stats: BucketStats = { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 };
  for (const insp of dedupeInspectionsByExtinguisherLatest(inspections)) {
    stats.total += 1;
    if (insp.status === 'pass') stats.passed += 1;
    else if (insp.status === 'fail') stats.failed += 1;
    else stats.pending += 1;
  }
  stats.percentage = stats.total > 0 ? Math.round(((stats.passed + stats.failed) / stats.total) * 100) : 0;
  return stats;
}

export const recalculateWorkspaceInspectionStats = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const data = request.data as { orgId?: string; workspaceId?: string };
  const { orgId, workspaceId } = data;
  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!workspaceId || typeof workspaceId !== 'string') throwInvalidArgument('workspaceId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);
  await validateSubscription(orgId);

  const wsRef = adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) throwNotFound('Workspace not found.');

  const wsData = wsSnap.data()!;
  const isArchived = wsData.status === 'archived';
  if (isArchived) {
    throwFailedPrecondition('Recalculation is only supported for active workspaces.');
  }

  const inspSnap = await adminDb.collection(`org/${orgId}/inspections`).where('workspaceId', '==', workspaceId).get();
  const inspections: LooseInspection[] = inspSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  })) as LooseInspection[];
  const agg = calculateStatsFromInspectionRows(inspections);

  await wsRef.update({
    'stats.total': agg.total,
    'stats.passed': agg.passed,
    'stats.failed': agg.failed,
    'stats.pending': agg.pending,
    'stats.lastUpdated': FieldValue.serverTimestamp(),
  });

  return {
    workspaceId,
    stats: {
      total: agg.total,
      passed: agg.passed,
      failed: agg.failed,
      pending: agg.pending,
      percentage: agg.percentage,
    },
  };
});

export const repairWorkspaceChecklist = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const data = request.data as { orgId?: string; workspaceId?: string };
  const { orgId, workspaceId } = data;
  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!workspaceId || typeof workspaceId !== 'string') throwInvalidArgument('workspaceId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);
  await validateSubscription(orgId);

  const wsRef = adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) throwNotFound('Workspace not found.');
  if (wsSnap.data()?.status === 'archived') {
    throwFailedPrecondition('Repair is only supported for active workspaces.');
  }

  const inspSnap = await adminDb.collection(`org/${orgId}/inspections`).where('workspaceId', '==', workspaceId).get();

  const byIdentity = new Map<string, typeof inspSnap.docs>();
  for (const doc of inspSnap.docs) {
    const data = { id: doc.id, ...doc.data() } as LooseInspection;
    const key = inspectionIdentity(data);
    const current = byIdentity.get(key) ?? [];
    current.push(doc);
    byIdentity.set(key, current);
  }

  let duplicatesDeleted = 0;
  const rowsCreated = 0;
  let batch = adminDb.batch();
  let batchCount = 0;

  for (const docs of byIdentity.values()) {
    if (docs.length <= 1) continue;
    const sorted = [...docs].sort((a, b) => {
      const aData = { id: a.id, ...a.data() } as LooseInspection;
      const bData = { id: b.id, ...b.data() } as LooseInspection;
      return inspectionActivityMs(bData) - inspectionActivityMs(aData);
    });
    const keeper = sorted.find((doc) => doc.data().status === 'pass' || doc.data().status === 'fail') ?? sorted[0];
    for (const doc of sorted) {
      if (doc.id === keeper.id) continue;
      if (doc.data().status !== 'pending') continue;
      batch.delete(doc.ref);
      duplicatesDeleted++;
      batchCount++;
      if (batchCount >= 499) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) await batch.commit();

  const repairedSnap = await adminDb.collection(`org/${orgId}/inspections`).where('workspaceId', '==', workspaceId).get();
  const repairedInspections: LooseInspection[] = repairedSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  })) as LooseInspection[];
  const stats = calculateStatsFromInspectionRows(repairedInspections);

  await wsRef.update({
    'stats.total': stats.total,
    'stats.passed': stats.passed,
    'stats.failed': stats.failed,
    'stats.pending': stats.pending,
    'stats.lastUpdated': FieldValue.serverTimestamp(),
  });

  return {
    workspaceId,
    rowsCreated,
    duplicatesDeleted,
    stats,
  };
});
