import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { FieldValue } from 'firebase-admin/firestore';

export const generateQRCode = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, extId } = request.data as { orgId: string; extId: string };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }
  if (!extId || typeof extId !== 'string') {
    throwInvalidArgument('extId is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extId}`);
  const extSnap = await extRef.get();

  if (!extSnap.exists) {
    throwNotFound('Extinguisher not found.');
  }

  // Generate a QR code value that encodes a deep link to this extinguisher
  const qrCodeValue = `ex3://${orgId}/${extId}`;
  const qrCodeUrl = `/qr/${orgId}/${extId}`;

  await extRef.update({
    qrCodeValue,
    qrCodeUrl,
    tagVersion: FieldValue.increment(1),
    tagStatus: 'active',
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog(orgId, {
    action: 'qr.generated',
    performedBy: uid,
    details: { extId, qrCodeValue },
  });

  return { qrCodeValue, qrCodeUrl };
});
