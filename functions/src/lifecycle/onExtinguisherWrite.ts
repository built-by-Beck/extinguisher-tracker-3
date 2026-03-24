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

    // Fetch active workspace outside transaction (queries not allowed in tx)
    const activeWorkspaceSnap = await adminDb
      .collection(`org/${orgId}/workspaces`)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    await adminDb.runTransaction(async (tx) => {
      const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extId}`);
      const extSnap = await tx.get(extRef);
      if (!extSnap.exists) return; // Doc deleted between trigger and tx

      const currentExtData = extSnap.data()!;
      if (currentExtData.lifecycleStatus !== 'active') return;

      const extType = (currentExtData.extinguisherType as string | null) ?? '';
      const hydroInterval = (currentExtData.hydroTestIntervalYears as number | null) ?? getHydroIntervalByType(extType);
      const needsSixYear = (currentExtData.requiresSixYearMaintenance as boolean | null) ?? requiresSixYear(extType);

      const lastMonthly = currentExtData.lastMonthlyInspection as Timestamp | null;
      const lastAnnual = currentExtData.lastAnnualInspection as Timestamp | null;
      const lastSixYear = currentExtData.lastSixYearMaintenance as Timestamp | null;
      const lastHydro = currentExtData.lastHydroTest as Timestamp | null;

      const nextMonthlyInspection = calculateNextMonthlyInspection(lastMonthly);
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

      // 2. Seed active workspace if one exists
      if (!activeWorkspaceSnap.empty) {
        const workspaceDoc = activeWorkspaceSnap.docs[0];
        const workspaceId = workspaceDoc.id;
        const inspectionRef = adminDb.doc(`org/${orgId}/inspections/${workspaceId}_${extId}`);
        const [workspaceTxSnap, inspectionTxSnap] = await Promise.all([
          tx.get(workspaceDoc.ref),
          tx.get(inspectionRef),
        ]);

        if (!inspectionTxSnap.exists && workspaceTxSnap.exists && workspaceTxSnap.data()?.status === 'active') {
          let section = (currentExtData.section as string | null) ?? '';
          const locationId = (currentExtData.locationId as string | null) ?? null;

          if (!section && locationId) {
            const locationRef = adminDb.doc(`org/${orgId}/locations/${locationId}`);
            const locationSnap = await tx.get(locationRef);
            if (locationSnap.exists) {
              section = ((locationSnap.data()?.name as string | null) ?? '').trim();
            }
          }

          tx.set(inspectionRef, {
            extinguisherId: extId,
            workspaceId,
            assetId: (currentExtData.assetId as string | null) ?? '',
            section,
            locationId: locationId ?? null,
            status: 'pending',
            inspectedAt: null,
            inspectedBy: null,
            inspectedByEmail: null,
            checklistData: null,
            notes: '',
            photoUrl: null,
            photoPath: null,
            gps: null,
            attestation: null,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
          });

          tx.update(workspaceDoc.ref, {
            'stats.total': FieldValue.increment(1),
            'stats.pending': FieldValue.increment(1),
            'stats.lastUpdated': serverTimestamp,
          });
        }
      }
    });
  },
);

