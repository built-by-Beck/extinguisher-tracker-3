/**
 * Cloud Function: retireExtinguisher
 * Permanently removes an extinguisher from service.
 * - Sets lifecycleStatus to 'retired'
 * - Clears all next* due date fields
 * - Writes audit log
 *
 * Callable by owner/admin.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';

interface RetireExtinguisherInput {
  orgId: string;
  extinguisherId: string;
  reason: string;
}

export const retireExtinguisher = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, extinguisherId, reason } = request.data as RetireExtinguisherInput;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!extinguisherId || typeof extinguisherId !== 'string') throwInvalidArgument('extinguisherId is required.');
  if (!reason || typeof reason !== 'string') throwInvalidArgument('reason is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extinguisherId}`);
  const extSnap = await extRef.get();
  if (!extSnap.exists) throwNotFound('Extinguisher not found.');

  const extData = extSnap.data()!;

  if (extData.lifecycleStatus === 'retired') {
    throwFailedPrecondition('Extinguisher is already retired.');
  }

  const now = Timestamp.now();

  await extRef.update({
    lifecycleStatus: 'retired',
    complianceStatus: 'retired',
    // Clear all next* due date fields — lifecycle tracking stops
    nextMonthlyInspection: null,
    nextAnnualInspection: null,
    nextSixYearMaintenance: null,
    nextHydroTest: null,
    overdueFlags: [],
    retiredAt: now,
    retiredBy: uid,
    retirementReason: reason,
    updatedAt: now,
  });

  await writeAuditLog(orgId, {
    action: 'extinguisher.retired',
    performedBy: uid,
    details: {
      extinguisherId,
      assetId: extData.assetId,
      reason,
    },
  });

  return { extinguisherId, lifecycleStatus: 'retired' };
});
