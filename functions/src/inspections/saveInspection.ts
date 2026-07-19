import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import {
  throwInvalidArgument,
  throwNotFound,
  throwFailedPrecondition,
} from '../utils/errors.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/** Safely coerce an unknown Firestore field value to Timestamp | null. */
function safeTimestamp(value: unknown): Timestamp | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value;
  if (
    typeof value === 'object' &&
    'seconds' in (value as object) &&
    'nanoseconds' in (value as object)
  ) {
    const v = value as { seconds: number; nanoseconds: number };
    return new Timestamp(v.seconds, v.nanoseconds);
  }
  return null;
}
import {
  calculateNextMonthlyInspection,
  calculateComplianceStatus,
  getHydroIntervalByType,
  normalizeMonthlyInspectionSchedule,
  requiresSixYear,
  type ExtinguisherForCalc,
} from '../lifecycle/complianceCalc.js';
import { canUseCustomAssetInspections } from '../billing/planConfig.js';

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
  checklistAnswers?: Record<
    string,
    {
      result: 'pass' | 'fail' | 'na' | 'unchecked';
      notes?: string;
      answeredAt?: unknown;
      answeredBy?: string;
    }
  >;
  notes?: string;
  details?: string;
  photoUrl?: string | null;
  photoPath?: string | null;
  gps?: {
    lat: number;
    lng: number;
    accuracy: number;
    altitude: number | null;
    capturedAt: string;
  } | null;
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

  if (!orgId || typeof orgId !== 'string')
    throwInvalidArgument('orgId is required.');
  if (!inspectionId || typeof inspectionId !== 'string')
    throwInvalidArgument('inspectionId is required.');
  if (!['pass', 'fail'].includes(status))
    throwInvalidArgument('status must be "pass" or "fail".');
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
    const targetType =
      (inspData.targetType as string | undefined) ?? 'extinguisher';

    const wsRef = adminDb.doc(
      `org/${orgId}/workspaces/${inspData.workspaceId}`,
    );
    const wsSnap = await tx.get(wsRef);

    const extRef =
      targetType === 'asset'
        ? null
        : adminDb.doc(`org/${orgId}/extinguishers/${inspData.extinguisherId}`);
    const extSnap = extRef ? await tx.get(extRef) : null;

    const orgSnap = await tx.get(adminDb.doc(`org/${orgId}`));
    const orgData = orgSnap.data() ?? {};
    const orgSettings =
      (orgData.settings as Record<string, unknown> | undefined) ?? {};
    const monthlySchedule = normalizeMonthlyInspectionSchedule(
      orgSettings.monthlyInspectionSchedule,
    );
    const orgTimezone =
      typeof orgSettings.timezone === 'string' ? orgSettings.timezone : 'UTC';

    // 3. Validation logic
    if (wsSnap.exists && wsSnap.data()?.status === 'archived') {
      throwFailedPrecondition(
        'Cannot modify inspections in an archived workspace.',
      );
    }
    if (targetType === 'asset') {
      if (
        !canUseCustomAssetInspections(
          typeof orgData.plan === 'string' ? orgData.plan : null,
          (orgData.featureFlags as Record<string, boolean> | undefined) ?? null,
        )
      ) {
        throwFailedPrecondition(
          'Custom Asset Inspections require a Pro plan or higher.',
        );
      }
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
      details: data.details ?? inspData.details ?? '',
      updatedAt: serverTimestamp,
    };

    if (data.checklistData) updateData.checklistData = data.checklistData;
    if (data.checklistAnswers)
      updateData.checklistAnswers = data.checklistAnswers;
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
      targetType,
      extinguisherId: inspData.extinguisherId ?? null,
      assetRefId: inspData.assetRefId ?? null,
      assetName: inspData.assetName ?? null,
      workspaceId: inspData.workspaceId,
      assetId: inspData.assetId,
      action: 'inspected',
      previousStatus,
      newStatus: status,
      isExpired: data.isExpired ?? false,
      checklistData: data.checklistData ?? null,
      checklistAnswers: data.checklistAnswers ?? null,
      checklistSnapshot: inspData.checklistSnapshot ?? null,
      notes: data.notes ?? null,
      details: data.details ?? null,
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
      if (previousStatus === 'pending')
        statsUpdate['stats.pending'] = FieldValue.increment(-1);
      else if (previousStatus === 'pass')
        statsUpdate['stats.passed'] = FieldValue.increment(-1);
      else if (previousStatus === 'fail')
        statsUpdate['stats.failed'] = FieldValue.increment(-1);

      // Increment new status count
      if (status === 'pass')
        statsUpdate['stats.passed'] = FieldValue.increment(1);
      else if (status === 'fail')
        statsUpdate['stats.failed'] = FieldValue.increment(1);

      tx.update(wsRef, statsUpdate);
    }

    // Update extinguisher lifecycle after inspection.
    // Any calculation error here must NOT block the inspection save — the
    // pass/fail record is primary data; lifecycle fields are derived/cached.
    if (targetType !== 'asset' && extRef && extSnap?.exists) {
      const extData = extSnap.data()!;

      try {
        const nextMonthlyInspection = calculateNextMonthlyInspection(
          now,
          monthlySchedule,
          orgTimezone,
        );

        const extType = (extData.extinguisherType as string | null) ?? '';
        const hydroIntervalRaw = extData.hydroTestIntervalYears;
        const hydroInterval =
          typeof hydroIntervalRaw === 'number'
            ? hydroIntervalRaw
            : getHydroIntervalByType(extType);
        const needsSixYear =
          typeof extData.requiresSixYearMaintenance === 'boolean'
            ? extData.requiresSixYearMaintenance
            : requiresSixYear(extType);

        const calcInput: ExtinguisherForCalc = {
          lifecycleStatus: extData.lifecycleStatus as string | null,
          extinguisherType: extData.extinguisherType as string | null,
          requiresSixYearMaintenance: needsSixYear,
          lastMonthlyInspection: now,
          lastAnnualInspection: safeTimestamp(extData.lastAnnualInspection),
          lastSixYearMaintenance: safeTimestamp(extData.lastSixYearMaintenance),
          lastHydroTest: safeTimestamp(extData.lastHydroTest),
          hydroTestIntervalYears: hydroInterval,
          nextMonthlyInspection,
          nextAnnualInspection: safeTimestamp(extData.nextAnnualInspection),
          nextSixYearMaintenance: safeTimestamp(extData.nextSixYearMaintenance),
          nextHydroTest: safeTimestamp(extData.nextHydroTest),
        };

        const { complianceStatus, overdueFlags } =
          calculateComplianceStatus(calcInput);

        tx.update(extRef, {
          isExpired: data.isExpired ?? false,
          lastMonthlyInspection: now,
          nextMonthlyInspection,
          complianceStatus,
          overdueFlags,
          updatedAt: serverTimestamp,
        });
      } catch (lifecycleErr: unknown) {
        // Log but do not rethrow — the inspection record is already written.
        // The lifecycle fields will be stale until the next recalculate run.
        console.error('[saveInspection] lifecycle update failed', {
          inspectionId,
          extinguisherId: inspData.extinguisherId as string | undefined,
          error:
            lifecycleErr instanceof Error
              ? lifecycleErr.message
              : String(lifecycleErr),
        });
      }
    }

    return { inspectionId, status, previousStatus };
  });
});
