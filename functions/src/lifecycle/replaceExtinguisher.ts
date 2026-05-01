/**
 * Cloud Function: replaceExtinguisher
 * In-place replacement: the extinguisher document (same id / asset slot) stays active.
 * - Writes a full snapshot of the prior document to subcollection replacementHistory
 * - Updates serial, barcode, physical fields, photos, notes; resets lifecycle for the new body
 * - Does not create a second active record for the same asset number
 *
 * Callable by owner/admin.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { Timestamp, FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import { throwInvalidArgument, throwNotFound, throwFailedPrecondition } from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';
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

function requireStringField(value: unknown, message: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throwFailedPrecondition(message);
  }
  return trimmed;
}

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
  barcodeFormat?: string | null;
  notes?: string | null;
  photos?: unknown;
}

interface ReplaceExtinguisherInput {
  orgId: string;
  oldExtinguisherId: string;
  newExtinguisherData: NewExtinguisherData;
  reason?: string;
}

function isInventoryActive(data: DocumentData): boolean {
  const ls = data.lifecycleStatus as string | null | undefined;
  const category = data.category as string | null | undefined;
  const status = data.status as string | null | undefined;
  const isActive = data.isActive as boolean | null | undefined;
  if (ls === 'replaced' || ls === 'retired' || ls === 'deleted') return false;
  if (category === 'replaced' || category === 'retired' || category === 'out_of_service') return false;
  if (status != null && status !== 'active') return false;
  if (isActive === false) return false;
  return ls === 'active' || ls == null || ls === '';
}

export const replaceExtinguisher = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, oldExtinguisherId, newExtinguisherData, reason } = request.data as ReplaceExtinguisherInput;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!oldExtinguisherId || typeof oldExtinguisherId !== 'string') throwInvalidArgument('oldExtinguisherId is required.');
  if (!newExtinguisherData || typeof newExtinguisherData !== 'object') throwInvalidArgument('newExtinguisherData is required.');
  if (!newExtinguisherData.serial) throwInvalidArgument('newExtinguisherData.serial is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const newSerial = newExtinguisherData.serial.trim();
  const newBarcode = newExtinguisherData.barcode != null ? String(newExtinguisherData.barcode).trim() : '';

  return await adminDb.runTransaction(async (tx) => {
    await validateSubscriptionTx(tx, orgId);
    const orgSnap = await tx.get(adminDb.doc(`org/${orgId}`));
    const orgData = orgSnap.data() ?? {};
    const orgSettings = (orgData.settings as Record<string, unknown> | undefined) ?? {};
    const monthlySchedule = normalizeMonthlyInspectionSchedule(orgSettings.monthlyInspectionSchedule);
    const orgTimezone = typeof orgSettings.timezone === 'string' ? orgSettings.timezone : 'UTC';

    const extRef = adminDb.doc(`org/${orgId}/extinguishers/${oldExtinguisherId}`);
    const extSnap = await tx.get(extRef);
    if (!extSnap.exists) throwNotFound('Extinguisher not found.');

    const oldExtData = extSnap.data()!;

    if (!isInventoryActive(oldExtData)) {
      throwFailedPrecondition('Only active extinguishers can be replaced.');
    }

    const oldAssetId = requireStringField(
      oldExtData.assetId,
      'Extinguisher asset number is missing. Add an asset number before replacing this extinguisher.',
    );
    const requestedAssetId = newExtinguisherData.assetId?.trim();
    if (requestedAssetId && requestedAssetId !== oldAssetId) {
      throwFailedPrecondition('Asset number is the permanent slot and cannot be changed during replacement.');
    }

    const colRef = adminDb.collection(`org/${orgId}/extinguishers`);
    const serialSnap = await tx.get(
      colRef.where('serial', '==', newSerial).where('deletedAt', '==', null).limit(8),
    );
    const serialConflict = serialSnap.docs.find((d) => d.id !== oldExtinguisherId && isInventoryActive(d.data()));
    if (serialConflict) {
      throwFailedPrecondition(`Serial number "${newSerial}" is already in use by another active extinguisher.`);
    }

    if (newBarcode) {
      const bcSnap = await tx.get(
        colRef.where('barcode', '==', newBarcode).where('deletedAt', '==', null).limit(8),
      );
      const bcConflict = bcSnap.docs.find((d) => d.id !== oldExtinguisherId && isInventoryActive(d.data()));
      if (bcConflict) {
        throwFailedPrecondition(`Barcode "${newBarcode}" is already in use by another active extinguisher.`);
      }
    }

    const assetSnap = await tx.get(
      colRef.where('assetId', '==', oldAssetId).where('deletedAt', '==', null).limit(16),
    );
    const assetOthers = assetSnap.docs.filter((d) => d.id !== oldExtinguisherId && isInventoryActive(d.data()));
    if (assetOthers.length > 0) {
      throwFailedPrecondition(
        'Another active extinguisher already uses this asset number. Resolve duplicates (Data organizer) before replacing.',
      );
    }

    const now = Timestamp.now();
    const serverTimestamp = FieldValue.serverTimestamp();

    const histRef = adminDb.collection(`org/${orgId}/extinguishers/${oldExtinguisherId}/replacementHistory`).doc();
    tx.set(histRef, {
      priorSnapshot: { ...oldExtData },
      replacedAt: now,
      replacedBy: uid,
      replacedByEmail: email,
      reason: reason ?? null,
      previousSerial: oldExtData.serial ?? null,
      previousBarcode: oldExtData.barcode ?? null,
      previousAssetId: oldExtData.assetId ?? null,
    });

    const extType = newExtinguisherData.extinguisherType ?? '';
    const hydroInterval = getHydroIntervalByType(extType);
    const needsSixYear = requiresSixYear(extType);

    const nextMonthlyInspection = calculateNextMonthlyInspection(null, monthlySchedule, orgTimezone);
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

    const photosPayload = newExtinguisherData.photos;
    const nextPhotos = Array.isArray(photosPayload)
      ? photosPayload
      : Array.isArray(oldExtData.photos)
        ? oldExtData.photos
        : [];

    tx.update(extRef, {
      assetId: oldAssetId,
      serial: newSerial,
      barcode: newBarcode || null,
      barcodeFormat: newBarcode ? (newExtinguisherData.barcodeFormat as string | null) ?? null : null,
      manufacturer: newExtinguisherData.manufacturer ?? null,
      extinguisherType: newExtinguisherData.extinguisherType ?? null,
      serviceClass: newExtinguisherData.serviceClass ?? null,
      extinguisherSize: newExtinguisherData.extinguisherSize ?? null,
      manufactureYear: newExtinguisherData.manufactureYear ?? null,
      manufactureDate: null,
      expirationYear: newExtinguisherData.expirationYear ?? null,
      notes: newExtinguisherData.notes ?? null,
      photos: nextPhotos,
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
      inServiceDate: now,
      replacesExtId: null,
      replacedByExtId: null,
      replacementHistory: [],
      status: 'active',
      isActive: true,
      updatedAt: serverTimestamp,
    });

    writeAuditLogTx(tx, orgId, {
      action: 'extinguisher.replaced',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'extinguisher',
      entityId: oldExtinguisherId,
      details: {
        extinguisherId: oldExtinguisherId,
        oldAssetId,
        newAssetId: oldAssetId,
        previousSerial: oldExtData.serial ?? null,
        newSerial,
        reason: reason ?? null,
        newExtinguisherId: oldExtinguisherId,
      },
    });

    return { extinguisherId: oldExtinguisherId };
  });
});
