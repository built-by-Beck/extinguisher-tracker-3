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

    // Also seed the current active workspace inspection row so workspace location cards
    // immediately reflect newly-created extinguishers.
    const activeWorkspaceSnap = await adminDb
      .collection(`org/${orgId}/workspaces`)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (activeWorkspaceSnap.empty) return;

    const workspaceDoc = activeWorkspaceSnap.docs[0];
    const workspaceId = workspaceDoc.id;
    const inspectionRef = adminDb.doc(`org/${orgId}/inspections/${workspaceId}_${extId}`);

    await adminDb.runTransaction(async (tx) => {
      const [workspaceTxSnap, inspectionTxSnap] = await Promise.all([
        tx.get(workspaceDoc.ref),
        tx.get(inspectionRef),
      ]);

      // Idempotency guard for at-least-once trigger delivery.
      if (inspectionTxSnap.exists) return;
      if (!workspaceTxSnap.exists || workspaceTxSnap.data()?.status !== 'active') return;

      let section = (extData.section as string | null) ?? '';
      const locationId = (extData.locationId as string | null) ?? null;

      // Fallback for legacy/partial data where section may be empty but locationId exists.
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
        assetId: (extData.assetId as string | null) ?? '',
        section,
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.update(workspaceDoc.ref, {
        'stats.total': FieldValue.increment(1),
        'stats.pending': FieldValue.increment(1),
        'stats.lastUpdated': FieldValue.serverTimestamp(),
      });
    });
  },
);
