/**
 * Firestore trigger: onExtinguisherCreated
 * Runs initial lifecycle calculation when a new extinguisher document is created.
 * Fires on: org/{orgId}/extinguishers/{extId}
 *
 * Only processes documents where lifecycleStatus == 'active'.
 * Calculates next due dates and sets complianceStatus.
 *
 * Author: built_by_Beck
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
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

export const onExtinguisherCreated = onDocumentCreated(
  'org/{orgId}/extinguishers/{extId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const extData = snap.data();
    const { orgId, extId } = event.params;

    // Only process active extinguishers
    if (extData.lifecycleStatus !== 'active') return;

    const extType = (extData.extinguisherType as string | null) ?? '';
    const hydroInterval = (extData.hydroTestIntervalYears as number | null) ?? getHydroIntervalByType(extType);
    const needsSixYear = (extData.requiresSixYearMaintenance as boolean | null) ?? requiresSixYear(extType);

    const lastMonthly = extData.lastMonthlyInspection as Timestamp | null;
    const lastAnnual = extData.lastAnnualInspection as Timestamp | null;
    const lastSixYear = extData.lastSixYearMaintenance as Timestamp | null;
    const lastHydro = extData.lastHydroTest as Timestamp | null;

    // Calculate next due dates
    const nextMonthlyInspection = calculateNextMonthlyInspection(lastMonthly);
    const nextAnnualInspection = calculateNextAnnualInspection(lastAnnual);
    const nextHydroTest = calculateNextHydroTest(lastHydro, hydroInterval);
    const nextSixYearMaintenance = needsSixYear
      ? calculateNextSixYearMaintenance(lastSixYear)
      : null;

    const calcInput: ExtinguisherForCalc = {
      lifecycleStatus: extData.lifecycleStatus as string,
      extinguisherType: extData.extinguisherType as string | null,
      requiresSixYearMaintenance: needsSixYear,
      lastMonthlyInspection: lastMonthly,
      lastAnnualInspection: lastAnnual,
      lastSixYearMaintenance: lastSixYear,
      lastHydroTest: lastHydro,
      hydroTestIntervalYears: hydroInterval,
      nextMonthlyInspection,
      nextAnnualInspection,
      nextSixYearMaintenance,
      nextHydroTest,
    };

    const { complianceStatus, overdueFlags } = calculateComplianceStatus(calcInput);

    const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extId}`);
    await extRef.update({
      nextMonthlyInspection,
      nextAnnualInspection,
      nextSixYearMaintenance,
      nextHydroTest,
      complianceStatus,
      overdueFlags,
      updatedAt: Timestamp.now(),
    });
  },
);
