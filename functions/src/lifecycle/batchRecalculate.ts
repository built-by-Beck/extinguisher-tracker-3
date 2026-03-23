/**
 * Cloud Function: batchRecalculateLifecycle
 * Recalculates lifecycle dates and compliance status for all active extinguishers in an org.
 * Callable by owner/admin. Uses Firestore batch writes (max 500 per batch).
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscription } from '../utils/subscription.js';
import { throwInvalidArgument } from '../utils/errors.js';
import {
  calculateNextMonthlyInspection,
  calculateNextAnnualInspection,
  calculateNextSixYearMaintenance,
  calculateNextHydroTest,
  calculateComplianceStatus,
  getHydroIntervalByType,
  requiresSixYear,
  type ExtinguisherForCalc,
} from './complianceCalc.js';

interface BatchRecalculateInput {
  orgId: string;
}

export const batchRecalculateLifecycle = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId } = request.data as BatchRecalculateInput;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);
  await validateSubscription(orgId);

  const extRef = adminDb.collection(`org/${orgId}/extinguishers`);
  const extSnap = await extRef
    .where('deletedAt', '==', null)
    .where('lifecycleStatus', '==', 'active')
    .get();

  let updatedCount = 0;
  let batch = adminDb.batch();
  let batchCount = 0;

  for (const docSnap of extSnap.docs) {
    const extData = docSnap.data();

    const ext: ExtinguisherForCalc = {
      lifecycleStatus: extData.lifecycleStatus as string,
      extinguisherType: extData.extinguisherType as string | null,
      requiresSixYearMaintenance: extData.requiresSixYearMaintenance as boolean | null,
      lastMonthlyInspection: extData.lastMonthlyInspection as Timestamp | null,
      lastAnnualInspection: extData.lastAnnualInspection as Timestamp | null,
      lastSixYearMaintenance: extData.lastSixYearMaintenance as Timestamp | null,
      lastHydroTest: extData.lastHydroTest as Timestamp | null,
      hydroTestIntervalYears: extData.hydroTestIntervalYears as number | null,
    };

    const extType = ext.extinguisherType ?? '';
    const hydroInterval = ext.hydroTestIntervalYears ?? getHydroIntervalByType(extType);
    const needsSixYear = ext.requiresSixYearMaintenance ?? requiresSixYear(extType);

    const nextMonthlyInspection = calculateNextMonthlyInspection(ext.lastMonthlyInspection);
    const nextAnnualInspection = calculateNextAnnualInspection(ext.lastAnnualInspection);
    const nextHydroTest = calculateNextHydroTest(ext.lastHydroTest, hydroInterval);
    const nextSixYearMaintenance = needsSixYear
      ? calculateNextSixYearMaintenance(ext.lastSixYearMaintenance)
      : null;

    const calcInput: ExtinguisherForCalc = {
      ...ext,
      nextMonthlyInspection,
      nextAnnualInspection,
      nextSixYearMaintenance,
      nextHydroTest,
    };

    const { complianceStatus, overdueFlags } = calculateComplianceStatus(calcInput);

    batch.update(docSnap.ref, {
      nextMonthlyInspection,
      nextAnnualInspection,
      nextSixYearMaintenance,
      nextHydroTest,
      complianceStatus,
      overdueFlags,
      updatedAt: Timestamp.now(),
    });

    updatedCount++;
    batchCount++;

    // Firestore batch write limit is 500
    if (batchCount >= 499) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  return { orgId, updatedCount };
});
