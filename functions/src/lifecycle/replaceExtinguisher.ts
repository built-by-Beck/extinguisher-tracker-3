/**
 * Cloud Function: replaceExtinguisher
 * Handles the lifecycle replacement of a fire extinguisher.
 * - Sets old extinguisher to 'replaced'
 * - Creates new extinguisher doc with preserved location
 * - Appends to replacement history
 * - Runs initial lifecycle calc on new unit
 * - Writes audit log
 *
 * Callable by owner/admin.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
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

interface NewExtinguisherData {
  assetId: string;
  serial: string;
  manufacturer?: string | null;
  extinguisherType?: string | null;
  serviceClass?: string | null;
  extinguisherSize?: string | null;
  manufactureYear?: number | null;
  expirationYear?: number | null;
  barcode?: string | null;
  notes?: string | null;
}

interface ReplaceExtinguisherInput {
  orgId: string;
  oldExtinguisherId: string;
  newExtinguisherData: NewExtinguisherData;
  reason?: string;
}

export const replaceExtinguisher = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, oldExtinguisherId, newExtinguisherData, reason } = request.data as ReplaceExtinguisherInput;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!oldExtinguisherId || typeof oldExtinguisherId !== 'string') throwInvalidArgument('oldExtinguisherId is required.');
  if (!newExtinguisherData || typeof newExtinguisherData !== 'object') throwInvalidArgument('newExtinguisherData is required.');
  if (!newExtinguisherData.assetId) throwInvalidArgument('newExtinguisherData.assetId is required.');
  if (!newExtinguisherData.serial) throwInvalidArgument('newExtinguisherData.serial is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  // Load old extinguisher
  const oldExtRef = adminDb.doc(`org/${orgId}/extinguishers/${oldExtinguisherId}`);
  const oldExtSnap = await oldExtRef.get();
  if (!oldExtSnap.exists) throwNotFound('Extinguisher not found.');

  const oldExtData = oldExtSnap.data()!;

  if (oldExtData.lifecycleStatus !== 'active') {
    throwFailedPrecondition('Only active extinguishers can be replaced.');
  }

  // Validate new assetId is unique
  const duplicateCheck = await adminDb.collection(`org/${orgId}/extinguishers`)
    .where('assetId', '==', newExtinguisherData.assetId)
    .where('deletedAt', '==', null)
    .limit(1)
    .get();
  if (!duplicateCheck.empty) {
    throwFailedPrecondition(`Asset ID "${newExtinguisherData.assetId}" is already in use.`);
  }

  const now = Timestamp.now();

  // Calculate lifecycle for new extinguisher
  const extType = newExtinguisherData.extinguisherType ?? '';
  const hydroInterval = getHydroIntervalByType(extType);
  const needsSixYear = requiresSixYear(extType);

  const nextMonthlyInspection = calculateNextMonthlyInspection(null);
  const nextAnnualInspection = calculateNextAnnualInspection(null);
  const nextHydroTest = calculateNextHydroTest(null, hydroInterval);
  const nextSixYearMaintenance = needsSixYear ? calculateNextSixYearMaintenance(null) : null;

  const calcInput: ExtinguisherForCalc = {
    lifecycleStatus: 'active',
    extinguisherType: newExtinguisherData.extinguisherType ?? null,
    requiresSixYearMaintenance: needsSixYear,
    lastMonthlyInspection: null,
    lastAnnualInspection: null,
    lastSixYearMaintenance: null,
    lastHydroTest: null,
    hydroTestIntervalYears: hydroInterval,
    nextMonthlyInspection,
    nextAnnualInspection,
    nextSixYearMaintenance,
    nextHydroTest,
  };

  const { complianceStatus, overdueFlags } = calculateComplianceStatus(calcInput);

  // Create new extinguisher (preserves location from old unit)
  const newExtRef = adminDb.collection(`org/${orgId}/extinguishers`).doc();
  const newExtId = newExtRef.id;

  const replacementEntry = {
    replacedExtId: oldExtinguisherId,
    replacedAssetId: oldExtData.assetId,
    replacedAt: now,
    replacedBy: uid,
    replacedByEmail: email,
    reason: reason ?? null,
  };

  await newExtRef.set({
    // New unit fields
    assetId: newExtinguisherData.assetId,
    serial: newExtinguisherData.serial,
    barcode: newExtinguisherData.barcode ?? null,
    barcodeFormat: null,
    qrCodeValue: null,
    qrCodeUrl: null,
    manufacturer: newExtinguisherData.manufacturer ?? null,
    category: 'standard',
    extinguisherType: newExtinguisherData.extinguisherType ?? null,
    serviceClass: newExtinguisherData.serviceClass ?? null,
    extinguisherSize: newExtinguisherData.extinguisherSize ?? null,
    manufactureDate: null,
    manufactureYear: newExtinguisherData.manufactureYear ?? null,
    installDate: null,
    inServiceDate: now,
    expirationYear: newExtinguisherData.expirationYear ?? null,
    // Preserve location from old unit
    vicinity: oldExtData.vicinity ?? '',
    parentLocation: oldExtData.parentLocation ?? '',
    section: oldExtData.section ?? '',
    locationId: oldExtData.locationId ?? null,
    photos: [],
    // Lifecycle fields
    lastMonthlyInspection: null,
    nextMonthlyInspection,
    lastAnnualInspection: null,
    nextAnnualInspection,
    lastSixYearMaintenance: null,
    nextSixYearMaintenance,
    lastHydroTest: null,
    nextHydroTest,
    hydroTestIntervalYears: hydroInterval,
    requiresSixYearMaintenance: needsSixYear,
    lifecycleStatus: 'active',
    complianceStatus,
    overdueFlags,
    // Link to old unit
    replacesExtId: oldExtinguisherId,
    replacedByExtId: null,
    replacementHistory: [replacementEntry],
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
  });

  // Update old extinguisher to 'replaced'
  await oldExtRef.update({
    lifecycleStatus: 'replaced',
    complianceStatus: 'replaced',
    replacedByExtId: newExtId,
    replacementHistory: FieldValue.arrayUnion(replacementEntry),
    updatedAt: now,
  });

  await writeAuditLog(orgId, {
    action: 'extinguisher.replaced',
    performedBy: uid,
    details: {
      oldExtinguisherId,
      oldAssetId: oldExtData.assetId,
      newExtinguisherId: newExtId,
      newAssetId: newExtinguisherData.assetId,
      reason: reason ?? null,
    },
  });

  return { oldExtinguisherId, newExtinguisherId: newExtId };
});
