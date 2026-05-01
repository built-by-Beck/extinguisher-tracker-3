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
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import {
  calculateNextMonthlyInspection,
  calculateNextAnnualInspection,
  calculateNextSixYearMaintenance,
  calculateNextHydroTest,
  calculateComplianceStatus,
  getHydroIntervalByType,
  normalizeMonthlyInspectionSchedule,
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

    // Only process active extinguishers.
    if (extData.lifecycleStatus !== 'active') return;
    // Match workspace seeding behavior: only standard assets are tracked in monthly workspaces.
    if (extData.category !== 'standard') return;

    await adminDb.runTransaction(async (tx) => {
      const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extId}`);
      const extSnap = await tx.get(extRef);
      if (!extSnap.exists) return; // Doc deleted between trigger and tx
      const orgSnap = await tx.get(adminDb.doc(`org/${orgId}`));
      const orgData = orgSnap.data() ?? {};
      const orgSettings = (orgData.settings as Record<string, unknown> | undefined) ?? {};
      const monthlySchedule = normalizeMonthlyInspectionSchedule(orgSettings.monthlyInspectionSchedule);
      const orgTimezone = typeof orgSettings.timezone === 'string' ? orgSettings.timezone : 'UTC';

      const currentExtData = extSnap.data()!;
      if (currentExtData.lifecycleStatus !== 'active') return;

      const extType = (currentExtData.extinguisherType as string | null) ?? '';
      const hydroInterval = (currentExtData.hydroTestIntervalYears as number | null) ?? getHydroIntervalByType(extType);
      const needsSixYear = (currentExtData.requiresSixYearMaintenance as boolean | null) ?? requiresSixYear(extType);

      const lastMonthly = currentExtData.lastMonthlyInspection as Timestamp | null;
      const lastAnnual = currentExtData.lastAnnualInspection as Timestamp | null;
      const lastSixYear = currentExtData.lastSixYearMaintenance as Timestamp | null;
      const lastHydro = currentExtData.lastHydroTest as Timestamp | null;

      const nextMonthlyInspection = calculateNextMonthlyInspection(lastMonthly, monthlySchedule, orgTimezone);
      const nextAnnualInspection = calculateNextAnnualInspection(lastAnnual);
      const nextHydroTest = calculateNextHydroTest(lastHydro, hydroInterval);
      const nextSixYearMaintenance = needsSixYear
        ? calculateNextSixYearMaintenance(lastSixYear)
        : null;

      const calcInput: ExtinguisherForCalc = {
        lifecycleStatus: currentExtData.lifecycleStatus as string,
        extinguisherType: currentExtData.extinguisherType as string | null,
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
      const serverTimestamp = FieldValue.serverTimestamp();

      // 1. Update extinguisher lifecycle
      tx.update(extRef, {
        nextMonthlyInspection,
        nextAnnualInspection,
        nextSixYearMaintenance,
        nextHydroTest,
        complianceStatus,
        overdueFlags,
        updatedAt: serverTimestamp,
      });

      // Workspace checklist scope is intentionally explicit. New extinguishers are added
      // to inventory here; owners/admins can enroll them into the active month separately.
    });
  },
);

