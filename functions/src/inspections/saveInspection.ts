import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  calculateNextMonthlyInspection,
  calculateComplianceStatus,
  getHydroIntervalByType,
  requiresSixYear,
  type ExtinguisherForCalc,
} from '../lifecycle/complianceCalc.js';

interface ChecklistData {
  pinPresent: string;
  tamperSealIntact: string;
  gaugeCorrectPressure: string;
  weightCorrect: string;
  noDamage: string;
  inDesignatedLocation: string;
  clearlyVisible: string;
  nearestUnder75ft: string;
  topUnder5ft: string;
  bottomOver4in: string;
  mountedSecurely: string;
  inspectionWithin30Days: string;
  tagSignedDated: string;
}

interface SaveInspectionData {
  orgId: string;
  inspectionId: string;
  status: 'pass' | 'fail';
  isExpired?: boolean;
  checklistData?: ChecklistData;
  notes?: string;
  photoUrl?: string | null;
  photoPath?: string | null;
  gps?: { lat: number; lng: number; accuracy: number; altitude: number | null; capturedAt: string } | null;
  attestation?: {
    confirmed: boolean;
    text: string;
    inspectorName: string;
    deviceId?: string;
  } | null;
}

export const saveInspection = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const data = request.data as SaveInspectionData;
  const { orgId, inspectionId, status } = data;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!inspectionId || typeof inspectionId !== 'string') throwInvalidArgument('inspectionId is required.');
  if (!['pass', 'fail'].includes(status)) throwInvalidArgument('status must be "pass" or "fail".');
  if (data.isExpired !== undefined && typeof data.isExpired !== 'boolean') {
    throwInvalidArgument('isExpired must be a boolean when provided.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin', 'inspector']);

  return await adminDb.runTransaction(async (tx) => {
    // 1. Subscription check
    await validateSubscriptionTx(tx, orgId);

    // 2. Load all required data (reads must come before writes)
    const inspRef = adminDb.doc(`org/${orgId}/inspections/${inspectionId}`);
    const inspSnap = await tx.get(inspRef);
    if (!inspSnap.exists) throwNotFound('Inspection not found.');

    const inspData = inspSnap.data()!;
    const previousStatus = inspData.status as string;

    const wsRef = adminDb.doc(`org/${orgId}/workspaces/${inspData.workspaceId}`);
    const wsSnap = await tx.get(wsRef);

    const extRef = adminDb.doc(`org/${orgId}/extinguishers/${inspData.extinguisherId}`);
    const extSnap = await tx.get(extRef);

    // 3. Validation logic
    if (wsSnap.exists && wsSnap.data()?.status === 'archived') {
      throwFailedPrecondition('Cannot modify inspections in an archived workspace.');
    }

    const serverTimestamp = FieldValue.serverTimestamp();
    const now = Timestamp.now();

    // 4. Prepare updates
    const updateData: Record<string, unknown> = {
      status,
      isExpired: data.isExpired ?? false,
      inspectedAt: serverTimestamp,
      inspectedBy: uid,
      inspectedByEmail: email,
      notes: data.notes ?? inspData.notes ?? '',
      updatedAt: serverTimestamp,
    };

    if (data.checklistData) updateData.checklistData = data.checklistData;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.photoPath !== undefined) updateData.photoPath = data.photoPath;
    if (data.gps !== undefined) updateData.gps = data.gps;
    if (data.attestation) {
      updateData.attestation = {
        confirmed: data.attestation.confirmed,
        text: data.attestation.text,
        inspectorName: data.attestation.inspectorName,
        inspectorUserId: uid,
        deviceId: data.attestation.deviceId ?? null,
        confirmedAt: serverTimestamp,
      };
    }

    // 5. Apply Updates (Writes)
    tx.update(inspRef, updateData);

    // Create immutable inspection event
    const eventRef = adminDb.collection(`org/${orgId}/inspectionEvents`).doc();
    tx.set(eventRef, {
      inspectionId,
      extinguisherId: inspData.extinguisherId,
      workspaceId: inspData.workspaceId,
      assetId: inspData.assetId,
      action: 'inspected',
      previousStatus,
      newStatus: status,
      isExpired: data.isExpired ?? false,
      checklistData: data.checklistData ?? null,
      notes: data.notes ?? null,
      photoUrl: data.photoUrl ?? null,
      gps: data.gps ?? null,
      attestation: data.attestation ?? null,
      performedBy: uid,
      performedByEmail: email,
      performedAt: serverTimestamp,
    });

    // Update workspace stats
    if (wsSnap.exists) {
      const statsUpdate: Record<string, unknown> = {
        'stats.lastUpdated': serverTimestamp,
      };

      // Decrement previous status count
      if (previousStatus === 'pending') statsUpdate['stats.pending'] = FieldValue.increment(-1);
      else if (previousStatus === 'pass') statsUpdate['stats.passed'] = FieldValue.increment(-1);
      else if (previousStatus === 'fail') statsUpdate['stats.failed'] = FieldValue.increment(-1);

      // Increment new status count
      if (status === 'pass') statsUpdate['stats.passed'] = FieldValue.increment(1);
      else if (status === 'fail') statsUpdate['stats.failed'] = FieldValue.increment(1);

      tx.update(wsRef, statsUpdate);
    }

    // Update extinguisher lifecycle after inspection
    if (extSnap.exists) {
      const extData = extSnap.data()!;

      // nextMonthlyInspection = now + 30 days (inspection just completed)
      const nextMonthlyInspection = calculateNextMonthlyInspection(now);

      // Build calc input with the freshly updated monthly date
      const extType = (extData.extinguisherType as string | null) ?? '';
      const hydroInterval = (extData.hydroTestIntervalYears as number | null) ?? getHydroIntervalByType(extType);
      const needsSixYear = (extData.requiresSixYearMaintenance as boolean | null) ?? requiresSixYear(extType);

      const calcInput: ExtinguisherForCalc = {
        lifecycleStatus: extData.lifecycleStatus as string | null,
        extinguisherType: extData.extinguisherType as string | null,
        requiresSixYearMaintenance: needsSixYear,
        lastMonthlyInspection: now,
        lastAnnualInspection: extData.lastAnnualInspection as Timestamp | null,
        lastSixYearMaintenance: extData.lastSixYearMaintenance as Timestamp | null,
        lastHydroTest: extData.lastHydroTest as Timestamp | null,
        hydroTestIntervalYears: hydroInterval,
        nextMonthlyInspection,
        nextAnnualInspection: extData.nextAnnualInspection as Timestamp | null,
        nextSixYearMaintenance: extData.nextSixYearMaintenance as Timestamp | null,
        nextHydroTest: extData.nextHydroTest as Timestamp | null,
      };

      const { complianceStatus, overdueFlags } = calculateComplianceStatus(calcInput);

      tx.update(extRef, {
        isExpired: data.isExpired ?? false,
        lastMonthlyInspection: now,
        nextMonthlyInspection,
        complianceStatus,
        overdueFlags,
        updatedAt: serverTimestamp,
      });
    }

    return { inspectionId, status, previousStatus };
  });
});

