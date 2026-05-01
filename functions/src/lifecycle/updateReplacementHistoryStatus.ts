/**
 * Cloud Function: updateReplacementHistoryStatus
 * Tracks service status for archived replacement-history units and can return
 * one archived physical unit to inventory as a new spare extinguisher record.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import { throwInvalidArgument, throwFailedPrecondition, throwNotFound } from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';

interface ReplacementStatusInput {
  orgId: string;
  extinguisherId: string;
  historyId: string;
  waitingForService?: boolean;
  sentForService?: boolean;
  discarded?: boolean;
  returned?: boolean;
  returnToSpare?: {
    assetId?: string;
    serial?: string;
    barcode?: string | null;
    locationId?: string | null;
    parentLocation?: string | null;
    section?: string | null;
    vicinity?: string | null;
  };
}

interface ListReplacementHistoryInput {
  orgId: string;
}

function requireString(value: unknown, message: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throwInvalidArgument(message);
  return trimmed;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
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

function replacementMillis(row: Record<string, unknown>): number {
  const replacedAt = row.replacedAt;
  if (
    typeof replacedAt === 'object' &&
    replacedAt !== null &&
    'toMillis' in replacedAt &&
    typeof replacedAt.toMillis === 'function'
  ) {
    return replacedAt.toMillis();
  }
  return 0;
}

async function assertNoActiveConflict(
  tx: FirebaseFirestore.Transaction,
  orgId: string,
  field: 'assetId' | 'serial' | 'barcode',
  value: string | null,
): Promise<void> {
  if (!value) return;
  const snap = await tx.get(
    adminDb.collection(`org/${orgId}/extinguishers`).where(field, '==', value).where('deletedAt', '==', null),
  );
  const conflict = snap.docs.find((doc) => isInventoryActive(doc.data()));
  if (!conflict) return;

  const label = field === 'assetId' ? 'Asset number' : field === 'serial' ? 'Serial number' : 'Barcode';
  throwFailedPrecondition(`${label} "${value}" is already in use by another active extinguisher.`);
}

export const updateReplacementHistoryStatus = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const input = request.data as ReplacementStatusInput;
  const orgId = requireString(input.orgId, 'orgId is required.');
  const extinguisherId = requireString(input.extinguisherId, 'extinguisherId is required.');
  const historyId = requireString(input.historyId, 'historyId is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  return await adminDb.runTransaction(async (tx) => {
    await validateSubscriptionTx(tx, orgId);

    const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extinguisherId}`);
    const histRef = adminDb.doc(`org/${orgId}/extinguishers/${extinguisherId}/replacementHistory/${historyId}`);
    const [extSnap, histSnap] = await Promise.all([tx.get(extRef), tx.get(histRef)]);
    if (!extSnap.exists) throwNotFound('Current extinguisher not found.');
    if (!histSnap.exists) throwNotFound('Replacement history row not found.');

    const histData = histSnap.data()!;
    const priorSnapshot = (histData.priorSnapshot ?? {}) as Record<string, unknown>;
    const waitingForService = input.waitingForService === true;
    const sentForService = input.sentForService === true;
    const discarded = input.discarded === true;
    const returned = input.returned === true;

    if (discarded && returned) {
      throwFailedPrecondition('A replaced extinguisher cannot be both discarded and returned.');
    }

    const serverTimestamp = FieldValue.serverTimestamp();
    let returnedSpareExtinguisherId = (histData.returnedSpareExtinguisherId as string | null | undefined) ?? null;

    if (returned && !returnedSpareExtinguisherId) {
      const spareAssetId = requireString(input.returnToSpare?.assetId, 'Spare asset number is required.');
      const priorSerial = optionalString(priorSnapshot.serial) ?? optionalString(histData.previousSerial);
      const spareSerial = optionalString(input.returnToSpare?.serial) ?? priorSerial;
      if (!spareSerial) {
        throwInvalidArgument('Spare serial number is required.');
      }
      const spareBarcode = optionalString(input.returnToSpare?.barcode);

      await assertNoActiveConflict(tx, orgId, 'assetId', spareAssetId);
      await assertNoActiveConflict(tx, orgId, 'serial', spareSerial);
      await assertNoActiveConflict(tx, orgId, 'barcode', spareBarcode);

      const spareRef = adminDb.collection(`org/${orgId}/extinguishers`).doc();
      returnedSpareExtinguisherId = spareRef.id;
      tx.set(spareRef, {
        assetId: spareAssetId,
        serial: spareSerial,
        barcode: spareBarcode,
        barcodeFormat: spareBarcode ? (priorSnapshot.barcodeFormat ?? null) : null,
        qrCodeValue: null,
        qrCodeUrl: null,
        manufacturer: priorSnapshot.manufacturer ?? null,
        category: 'spare',
        extinguisherType: priorSnapshot.extinguisherType ?? null,
        serviceClass: priorSnapshot.serviceClass ?? null,
        extinguisherSize: priorSnapshot.extinguisherSize ?? null,
        manufactureDate: priorSnapshot.manufactureDate ?? null,
        manufactureYear: priorSnapshot.manufactureYear ?? null,
        installDate: priorSnapshot.installDate ?? null,
        inServiceDate: serverTimestamp,
        expirationYear: priorSnapshot.expirationYear ?? null,
        isExpired: priorSnapshot.isExpired ?? false,
        vicinity: optionalString(input.returnToSpare?.vicinity) ?? (priorSnapshot.vicinity ?? ''),
        parentLocation: optionalString(input.returnToSpare?.parentLocation) ?? (priorSnapshot.parentLocation ?? ''),
        section: optionalString(input.returnToSpare?.section) ?? (priorSnapshot.section ?? ''),
        locationId: optionalString(input.returnToSpare?.locationId) ?? (priorSnapshot.locationId ?? null),
        photos: Array.isArray(priorSnapshot.photos) ? priorSnapshot.photos : [],
        lastMonthlyInspection: priorSnapshot.lastMonthlyInspection ?? null,
        nextMonthlyInspection: priorSnapshot.nextMonthlyInspection ?? null,
        lastAnnualInspection: priorSnapshot.lastAnnualInspection ?? null,
        nextAnnualInspection: priorSnapshot.nextAnnualInspection ?? null,
        annualInspectorName: priorSnapshot.annualInspectorName ?? null,
        annualInspectorCompany: priorSnapshot.annualInspectorCompany ?? null,
        annualInspectionNotes: priorSnapshot.annualInspectionNotes ?? null,
        lastSixYearMaintenance: priorSnapshot.lastSixYearMaintenance ?? null,
        nextSixYearMaintenance: priorSnapshot.nextSixYearMaintenance ?? null,
        requiresSixYearMaintenance: priorSnapshot.requiresSixYearMaintenance ?? null,
        lastHydroTest: priorSnapshot.lastHydroTest ?? null,
        nextHydroTest: priorSnapshot.nextHydroTest ?? null,
        hydroTestIntervalYears: priorSnapshot.hydroTestIntervalYears ?? null,
        lifecycleStatus: 'active',
        complianceStatus: priorSnapshot.complianceStatus ?? 'missing_data',
        overdueFlags: Array.isArray(priorSnapshot.overdueFlags) ? priorSnapshot.overdueFlags : [],
        replacedByExtId: null,
        replacesExtId: null,
        replacementHistory: [],
        status: 'active',
        isActive: true,
        notes: priorSnapshot.notes ?? null,
        returnedFromReplacement: {
          extinguisherId,
          historyId,
          returnedAt: serverTimestamp,
          returnedBy: uid,
        },
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
        createdBy: uid,
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
      });

      writeAuditLogTx(tx, orgId, {
        action: 'extinguisher.returned_to_spare',
        performedBy: uid,
        performedByEmail: email,
        entityType: 'extinguisher',
        entityId: returnedSpareExtinguisherId,
        details: {
          sourceExtinguisherId: extinguisherId,
          replacementHistoryId: historyId,
          spareAssetId,
          spareSerial,
        },
      });
    } else if (!returned && returnedSpareExtinguisherId) {
      throwFailedPrecondition('Returned status cannot be cleared after a spare record has been created.');
    }

    tx.update(histRef, {
      waitingForService,
      sentForService,
      discarded,
      returned,
      returnedSpareExtinguisherId,
      returnedAt: returned && returnedSpareExtinguisherId ? (histData.returnedAt ?? serverTimestamp) : null,
      returnedBy: returned && returnedSpareExtinguisherId ? (histData.returnedBy ?? uid) : null,
      serviceStatusUpdatedAt: serverTimestamp,
      serviceStatusUpdatedBy: uid,
    });

    writeAuditLogTx(tx, orgId, {
      action: 'replacement_history.status_updated',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'replacementHistory',
      entityId: historyId,
      details: {
        extinguisherId,
        waitingForService,
        sentForService,
        discarded,
        returned,
        returnedSpareExtinguisherId,
      },
    });

    return { historyId, returnedSpareExtinguisherId };
  });
});

export const listReplacementHistory = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId } = request.data as ListReplacementHistoryInput;
  const normalizedOrgId = requireString(orgId, 'orgId is required.');

  await validateMembership(normalizedOrgId, uid, ['owner', 'admin', 'inspector', 'viewer']);

  const snap = await adminDb.collectionGroup('replacementHistory').where('orgId', '==', normalizedOrgId).limit(500).get();
  const rows: Array<Record<string, unknown> & { id: string }> = snap.docs
    .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      }))
    .sort((a, b) => replacementMillis(b) - replacementMillis(a));

  return { rows };
});
