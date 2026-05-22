/**
 * Callable: updateExtinguisherStatus
 * Corrects lifecycle / category / denormalized status flags without running
 * the full replace or retire workflows (e.g. wrong "replaced" blocking Replace).
 *
 * Owner/admin only. Org-scoped. Writes audit log.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import {
  throwInvalidArgument,
  throwNotFound,
  throwFailedPrecondition,
} from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';

export type UpdateableExtinguisherStatus =
  | 'active'
  | 'spare'
  | 'replaced'
  | 'retired'
  | 'out_of_service';

export interface UpdateExtinguisherStatusInput {
  orgId: string;
  extinguisherId?: string;
  assetId?: string;
  newStatus: UpdateableExtinguisherStatus;
  /** Optional note for audit when moving to retired */
  reason?: string;
}

function isInventoryActive(data: DocumentData): boolean {
  const ls = data.lifecycleStatus as string | null | undefined;
  const category = data.category as string | null | undefined;
  const status = data.status as string | null | undefined;
  const isActive = data.isActive as boolean | null | undefined;
  if (ls === 'replaced' || ls === 'retired' || ls === 'deleted') return false;
  if (
    category === 'replaced' ||
    category === 'retired' ||
    category === 'out_of_service'
  )
    return false;
  if (status != null && status !== 'active') return false;
  if (isActive === false) return false;
  return ls === 'active' || ls == null || ls === '';
}

function parseTargetStatus(value: unknown): UpdateableExtinguisherStatus {
  if (typeof value !== 'string') {
    throwInvalidArgument('newStatus is required.');
  }
  const v = value.trim().toLowerCase().replace(/-/g, '_');
  const allowed: UpdateableExtinguisherStatus[] = [
    'active',
    'spare',
    'replaced',
    'retired',
    'out_of_service',
  ];
  if (v === 'out of service') return 'out_of_service';
  if (allowed.includes(v as UpdateableExtinguisherStatus)) {
    return v as UpdateableExtinguisherStatus;
  }
  throwInvalidArgument(
    `newStatus must be one of: ${allowed.join(', ')} (got "${value}").`,
  );
}

function buildUpdateFields(
  target: UpdateableExtinguisherStatus,
  uid: string,
  reason: string | null,
): Record<string, unknown> {
  const serverTimestamp = FieldValue.serverTimestamp();
  const base = { updatedAt: serverTimestamp };

  switch (target) {
    case 'active':
      return {
        ...base,
        lifecycleStatus: 'active',
        category: 'standard',
        status: 'active',
        isActive: true,
        replacedByExtId: null,
        replacesExtId: null,
        retiredAt: null,
        retiredBy: null,
        retirementReason: null,
        complianceStatus: null,
        overdueFlags: [],
      };
    case 'spare':
      return {
        ...base,
        lifecycleStatus: 'spare',
        category: 'spare',
        status: 'active',
        isActive: true,
        replacedByExtId: null,
        replacesExtId: null,
        retiredAt: null,
        retiredBy: null,
        retirementReason: null,
        complianceStatus: null,
        overdueFlags: [],
      };
    case 'replaced':
      return {
        ...base,
        lifecycleStatus: 'replaced',
        category: 'replaced',
        status: 'replaced',
        isActive: false,
        complianceStatus: 'replaced',
        overdueFlags: [],
        retiredAt: null,
        retiredBy: null,
        retirementReason: null,
      };
    case 'retired':
      return {
        ...base,
        lifecycleStatus: 'retired',
        category: 'retired',
        status: 'retired',
        isActive: false,
        complianceStatus: 'retired',
        nextMonthlyInspection: null,
        nextAnnualInspection: null,
        nextSixYearMaintenance: null,
        nextHydroTest: null,
        overdueFlags: [],
        retiredAt: serverTimestamp,
        retiredBy: uid,
        retirementReason: reason?.trim() || 'Status set to retired',
      };
    case 'out_of_service':
      return {
        ...base,
        lifecycleStatus: 'out_of_service',
        category: 'out_of_service',
        status: 'out_of_service',
        isActive: false,
        complianceStatus: null,
        overdueFlags: [],
        retiredAt: null,
        retiredBy: null,
        retirementReason: null,
        replacedByExtId: null,
        replacesExtId: null,
      };
  }
}

function resolveCurrentTarget(data: DocumentData): UpdateableExtinguisherStatus {
  const ls = (data.lifecycleStatus as string | null | undefined)?.toLowerCase();
  const cat = (data.category as string | null | undefined)?.toLowerCase();
  if (ls === 'spare' || cat === 'spare') return 'spare';
  if (ls === 'replaced' || cat === 'replaced') return 'replaced';
  if (ls === 'retired' || cat === 'retired') return 'retired';
  if (ls === 'out_of_service' || cat === 'out_of_service')
    return 'out_of_service';
  return 'active';
}

export const updateExtinguisherStatus = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const body = request.data as UpdateExtinguisherStatusInput;
  const { orgId, extinguisherId, assetId, reason } = body;
  const newStatus = parseTargetStatus(body.newStatus);

  if (!orgId || typeof orgId !== 'string')
    throwInvalidArgument('orgId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  let resolvedId = typeof extinguisherId === 'string' ? extinguisherId.trim() : '';
  const assetQuery = typeof assetId === 'string' ? assetId.trim() : '';

  if (!resolvedId && !assetQuery) {
    throwInvalidArgument('extinguisherId or assetId is required.');
  }

  if (!resolvedId && assetQuery) {
    const snap = await adminDb
      .collection(`org/${orgId}/extinguishers`)
      .where('assetId', '==', assetQuery)
      .where('deletedAt', '==', null)
      .limit(16)
      .get();
    if (snap.empty) throwNotFound('No extinguisher found for that asset number.');
    if (snap.size > 1) {
      throwFailedPrecondition(
        'Multiple extinguishers share that asset number; pass extinguisherId instead.',
      );
    }
    resolvedId = snap.docs[0]!.id;
  }

  return await adminDb.runTransaction(async (tx) => {
    await validateSubscriptionTx(tx, orgId);
    const extRef = adminDb.doc(`org/${orgId}/extinguishers/${resolvedId}`);
    const extSnap = await tx.get(extRef);
    if (!extSnap.exists) throwNotFound('Extinguisher not found.');
    const extData = extSnap.data()!;
    if (extData.deletedAt != null) {
      throwFailedPrecondition('Cannot change status of a deleted extinguisher.');
    }
    if (extData.lifecycleStatus === 'deleted') {
      throwFailedPrecondition('Cannot change status of a deleted extinguisher.');
    }

    const current = resolveCurrentTarget(extData);
    if (current === newStatus) {
      return {
        extinguisherId: resolvedId,
        assetId: extData.assetId ?? '',
        newStatus,
        unchanged: true,
      };
    }

    if (newStatus === 'active') {
      const asset = String(extData.assetId ?? '').trim();
      if (!asset) {
        throwFailedPrecondition(
          'Cannot set active without an asset number on this record.',
        );
      }
      const colRef = adminDb.collection(`org/${orgId}/extinguishers`);
      const assetSnap = await tx.get(
        colRef.where('assetId', '==', asset).where('deletedAt', '==', null),
      );
      const conflict = assetSnap.docs.find(
        (d) => d.id !== resolvedId && isInventoryActive(d.data()),
      );
      if (conflict) {
        throwFailedPrecondition(
          'Another active extinguisher already uses this asset number. Resolve duplicates before activating this row.',
        );
      }
    }

    const patch = buildUpdateFields(newStatus, uid, reason ?? null);
    tx.update(extRef, patch);

    writeAuditLogTx(tx, orgId, {
      action: 'extinguisher.status_updated',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'extinguisher',
      entityId: resolvedId,
      details: {
        extinguisherId: resolvedId,
        assetId: extData.assetId ?? null,
        previousStatus: current,
        newStatus,
        reason: reason?.trim() || null,
      },
    });

    return {
      extinguisherId: resolvedId,
      assetId: extData.assetId ?? '',
      newStatus,
      unchanged: false,
    };
  });
});
