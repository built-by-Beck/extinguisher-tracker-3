/**
 * Callable: dedupeActiveExtinguishersByAssetId
 * When multiple non-deleted "active" inventory rows share the same assetId, keeps the
 * newest (by createdAt) and retires the others so only one active slot remains.
 *
 * Owner/admin only.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscription } from '../utils/subscription.js';
import { throwInvalidArgument } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';

interface DedupeInput {
  orgId: string;
}

interface DedupeOutput {
  retiredCount: number;
}

function isInventoryActive(data: DocumentData): boolean {
  const ls = data.lifecycleStatus as string | null | undefined;
  const category = data.category as string | null | undefined;
  const status = data.status as string | null | undefined;
  const isActive = data.isActive as boolean | null | undefined;
  if (ls === 'replaced' || ls === 'retired' || ls === 'deleted') return false;
  if (category === 'replaced' || category === 'retired' || category === 'out_of_service') return false;
  if (status != null && status !== 'active') return false;
  if (isActive === false) return false;
  return ls === 'active' || ls == null || ls === '';
}

function createdMillis(data: DocumentData): number {
  const c = data.createdAt as Timestamp | undefined;
  if (c && typeof c.toMillis === 'function') return c.toMillis();
  return 0;
}

export const dedupeActiveExtinguishersByAssetId = onCall<DedupeInput, Promise<DedupeOutput>>(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId } = request.data as DedupeInput;

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);
  await validateSubscription(orgId);

  const snap = await adminDb.collection(`org/${orgId}/extinguishers`).where('deletedAt', '==', null).get();

  if (snap.empty) {
    return { retiredCount: 0 };
  }

  const activeDocs = snap.docs.filter((d) => isInventoryActive(d.data()));
  const byAsset = new Map<string, QueryDocumentSnapshot<DocumentData>[]>();

  for (const d of activeDocs) {
    const aid = (d.data().assetId as string | undefined) ?? '';
    if (!aid.trim()) continue;
    if (!byAsset.has(aid)) byAsset.set(aid, []);
    byAsset.get(aid)!.push(d);
  }

  const toRetire: QueryDocumentSnapshot<DocumentData>[] = [];
  for (const [, docs] of byAsset) {
    if (docs.length < 2) continue;
    const sorted = [...docs].sort((a, b) => createdMillis(b.data()) - createdMillis(a.data()));
    const [, ...dupes] = sorted;
    toRetire.push(...dupes);
  }

  let retiredCount = 0;
  const serverTs = FieldValue.serverTimestamp();

  for (let i = 0; i < toRetire.length; i += 450) {
    const chunk = toRetire.slice(i, i + 450);
    const batch = adminDb.batch();
    for (const d of chunk) {
      batch.update(d.ref, {
        lifecycleStatus: 'retired',
        complianceStatus: 'retired',
        nextMonthlyInspection: null,
        nextAnnualInspection: null,
        nextSixYearMaintenance: null,
        nextHydroTest: null,
        overdueFlags: [],
        retiredAt: serverTs,
        retiredBy: uid,
        retirementReason: 'Duplicate active asset slot (auto-dedupe by asset number)',
        status: 'retired',
        isActive: false,
        updatedAt: serverTs,
      });
    }
    await batch.commit();
    retiredCount += chunk.length;
  }

  if (retiredCount > 0) {
    await writeAuditLog(orgId, {
      action: 'extinguisher.duplicates_deduped',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'extinguisher',
      entityId: null,
      details: {
        retiredCount,
        retiredIds: toRetire.map((d) => d.id),
      },
    });
  }

  return { retiredCount };
});
