/**
 * Cloud Function: recalculateExtinguisherLifecycle
 * Recalculates lifecycle dates and compliance status for a single extinguisher.
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

interface RecalculateInput {
  orgId: string;
  extinguisherId: string;
}

export const recalculateExtinguisherLifecycle = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, extinguisherId } = request.data as RecalculateInput;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!extinguisherId || typeof extinguisherId !== 'string') throwInvalidArgument('extinguisherId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extinguisherId}`);
  const extSnap = await extRef.get();
  if (!extSnap.exists) throwNotFound('Extinguisher not found.');
  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  const orgData = orgSnap.data() ?? {};
  const orgSettings = (orgData.settings as Record<string, unknown> | undefined) ?? {};
  const monthlySchedule = normalizeMonthlyInspectionSchedule(orgSettings.monthlyInspectionSchedule);
  const orgTimezone = typeof orgSettings.timezone === 'string' ? orgSettings.timezone : 'UTC';

  const extData = extSnap.data()!;

  if (extData.lifecycleStatus !== 'active') {
    throwFailedPrecondition('Lifecycle recalculation only applies to active extinguishers.');
  }

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

  const nextMonthlyInspection = calculateNextMonthlyInspection(ext.lastMonthlyInspection, monthlySchedule, orgTimezone);
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

  await extRef.update({
    nextMonthlyInspection,
    nextAnnualInspection,
    nextSixYearMaintenance,
    nextHydroTest,
    complianceStatus,
    overdueFlags,
    updatedAt: Timestamp.now(),
  });

  return { extinguisherId, complianceStatus, overdueFlags };
});
