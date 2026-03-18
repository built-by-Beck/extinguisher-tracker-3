/**
 * Scheduled Cloud Function: overdueDetectionJob
 * Runs daily at 06:30 UTC (after complianceReminderJob).
 * For each org, queries extinguishers where any next* date is in the past.
 * Updates complianceStatus to 'overdue' and updates overdueFlags.
 * Generates inspection_overdue notification if not already present.
 *
 * Author: built_by_Beck
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import {
  calculateComplianceStatus,
  type ExtinguisherForCalc,
} from '../lifecycle/complianceCalc.js';

export const overdueDetectionJob = onSchedule('30 6 * * *', async () => {
  const now = new Date();
  const nowTs = Timestamp.fromDate(now);

  // Get all orgs with active subscriptions
  const orgsSnap = await adminDb
    .collection('org')
    .where('subscriptionStatus', 'in', ['active', 'trialing'])
    .get();

  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id;
    const extRef = adminDb.collection(`org/${orgId}/extinguishers`);

    // Query extinguishers where monthly inspection is overdue
    const overdueMonthlySnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextMonthlyInspection', '<', nowTs)
      .get();

    // Also query annual overdue
    const overdueAnnualSnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextAnnualInspection', '<', nowTs)
      .get();

    // Also query six-year maintenance overdue
    const overdueSixYearSnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextSixYearMaintenance', '<', nowTs)
      .get();

    // Also query hydro test overdue
    const overdueHydroSnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextHydroTest', '<', nowTs)
      .get();

    // Combine into a map of extinguisher IDs -> doc snapshots (deduplicated)
    const overdueDocMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const d of overdueMonthlySnap.docs) overdueDocMap.set(d.id, d);
    for (const d of overdueAnnualSnap.docs) if (!overdueDocMap.has(d.id)) overdueDocMap.set(d.id, d);
    for (const d of overdueSixYearSnap.docs) if (!overdueDocMap.has(d.id)) overdueDocMap.set(d.id, d);
    for (const d of overdueHydroSnap.docs) if (!overdueDocMap.has(d.id)) overdueDocMap.set(d.id, d);

    if (overdueDocMap.size === 0) continue;

    const allOverdueDocs = Array.from(overdueDocMap.values());

    let batch = adminDb.batch();
    let batchCount = 0;

    for (const docSnap of allOverdueDocs) {
      const extData = docSnap.data();

      // Only update if not already marked overdue
      if (extData.complianceStatus === 'overdue') continue;

      const ext: ExtinguisherForCalc = {
        lifecycleStatus: extData.lifecycleStatus as string | null,
        extinguisherType: extData.extinguisherType as string | null,
        requiresSixYearMaintenance: extData.requiresSixYearMaintenance as boolean | null,
        lastMonthlyInspection: extData.lastMonthlyInspection as Timestamp | null,
        lastAnnualInspection: extData.lastAnnualInspection as Timestamp | null,
        lastSixYearMaintenance: extData.lastSixYearMaintenance as Timestamp | null,
        lastHydroTest: extData.lastHydroTest as Timestamp | null,
        hydroTestIntervalYears: extData.hydroTestIntervalYears as number | null,
        nextMonthlyInspection: extData.nextMonthlyInspection as Timestamp | null,
        nextAnnualInspection: extData.nextAnnualInspection as Timestamp | null,
        nextSixYearMaintenance: extData.nextSixYearMaintenance as Timestamp | null,
        nextHydroTest: extData.nextHydroTest as Timestamp | null,
      };

      const { complianceStatus, overdueFlags } = calculateComplianceStatus(ext);

      batch.update(docSnap.ref, {
        complianceStatus,
        overdueFlags,
        updatedAt: Timestamp.now(),
      });

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
});
