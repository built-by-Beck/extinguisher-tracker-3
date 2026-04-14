import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import { throwInvalidArgument, throwNotFound, throwPermissionDenied } from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';

type AiNoteStatus = 'open' | 'in_progress' | 'resolved';

interface UpdateAiNoteStatusInput {
  orgId: string;
  noteId: string;
  status: AiNoteStatus;
}

interface UpdateAiNoteStatusResult {
  success: boolean;
}

const VALID_STATUSES: AiNoteStatus[] = ['open', 'in_progress', 'resolved'];

export const updateAiNoteStatus = onCall<UpdateAiNoteStatusInput, Promise<UpdateAiNoteStatusResult>>(
  { enforceAppCheck: false },
  async (request) => {
    const { uid, email } = validateAuth(request);
    const { orgId, noteId, status } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }
    if (!noteId || typeof noteId !== 'string') {
      throwInvalidArgument('Note ID is required.');
    }
    if (!VALID_STATUSES.includes(status)) {
      throwInvalidArgument('Status must be one of: open, in_progress, resolved.');
    }

    await validateMembership(orgId, uid, ['owner', 'admin', 'inspector']);

    const orgSnap = await adminDb.doc(`org/${orgId}`).get();
    const orgData = orgSnap.data();
    const plan = typeof orgData?.plan === 'string' ? orgData.plan : null;
    const featureEnabled = orgData?.featureFlags?.aiAssistant === true;
    const hasAiAssistant = featureEnabled || ['pro', 'elite', 'enterprise'].includes(plan ?? '');
    if (!hasAiAssistant) {
      throwPermissionDenied('AI assistant is not enabled for this organization.');
    }

    const noteRef = adminDb.doc(`org/${orgId}/aiNotes/${noteId}`);
    const eventRef = adminDb.collection(`org/${orgId}/aiNoteEvents`).doc();

    await adminDb.runTransaction(async (tx) => {
      await validateSubscriptionTx(tx, orgId);
      const noteSnap = await tx.get(noteRef);

      if (!noteSnap.exists) {
        throwNotFound('AI note not found.');
      }

      const currentStatus = noteSnap.get('status') as AiNoteStatus | undefined;
      if (!currentStatus || !VALID_STATUSES.includes(currentStatus)) {
        throwInvalidArgument('Existing note has invalid status.');
      }

      if (currentStatus === status) {
        return;
      }

      const ts = FieldValue.serverTimestamp();
      tx.update(noteRef, {
        status,
        updatedBy: uid,
        updatedByEmail: email,
        updatedAt: ts,
      });
      tx.set(eventRef, {
        noteId,
        action: 'status_updated',
        fromStatus: currentStatus,
        toStatus: status,
        performedBy: uid,
        performedByEmail: email,
        performedAt: ts,
        details: {},
      });

      writeAuditLogTx(tx, orgId, {
        action: 'ai.note_status_updated',
        performedBy: uid,
        performedByEmail: email,
        entityType: 'aiNote',
        entityId: noteId,
        details: {
          fromStatus: currentStatus,
          toStatus: status,
        },
      });
    });

    return { success: true };
  },
);
