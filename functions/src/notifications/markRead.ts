/**
 * Cloud Function: markNotificationRead
 * Adds the calling user's UID to the readBy array on a notification document.
 * Client-side writes to notifications are blocked by security rules, so this
 * Cloud Function acts as the privileged write path.
 *
 * Callable by any active org member.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound } from '../utils/errors.js';

interface MarkReadInput {
  orgId: string;
  notificationId: string;
}

export const markNotificationRead = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, notificationId } = request.data as MarkReadInput;

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!notificationId || typeof notificationId !== 'string') throwInvalidArgument('notificationId is required.');

  // Any active member can mark notifications as read
  await validateMembership(orgId, uid, ['owner', 'admin', 'inspector', 'viewer']);

  const notifRef = adminDb.doc(`org/${orgId}/notifications/${notificationId}`);
  const notifSnap = await notifRef.get();
  if (!notifSnap.exists) throwNotFound('Notification not found.');

  await notifRef.update({
    readBy: FieldValue.arrayUnion(uid),
  });

  return { notificationId, read: true };
});
