import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscription } from '../utils/subscription.js';
import { throwInvalidArgument, throwPermissionDenied } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';

interface CreateAiNoteInput {
  orgId: string;
  content: string;
  title?: string;
  source?: 'manual' | 'ai_suggested';
}

interface CreateAiNoteResult {
  noteId: string;
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export const createAiNote = onCall<CreateAiNoteInput, Promise<CreateAiNoteResult>>(
  { enforceAppCheck: false },
  async (request) => {
    const { uid, email } = validateAuth(request);
    const { orgId } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }

    await validateMembership(orgId, uid, ['owner', 'admin', 'inspector']);
    await validateSubscription(orgId);

    const orgSnap = await adminDb.doc(`org/${orgId}`).get();
    const orgData = orgSnap.data();
    const plan = typeof orgData?.plan === 'string' ? orgData.plan : null;
    const featureEnabled = orgData?.featureFlags?.aiAssistant === true;
    const hasAiAssistant = featureEnabled || ['pro', 'elite', 'enterprise'].includes(plan ?? '');
    if (!hasAiAssistant) {
      throwPermissionDenied('AI assistant is not enabled for this organization.');
    }

    const content = sanitizeText(request.data.content, 4000);
    const title = sanitizeText(request.data.title, 120);
    const source = request.data.source === 'ai_suggested' ? 'ai_suggested' : 'manual';

    if (!content) {
      throwInvalidArgument('Note content is required.');
    }

    const notesRef = adminDb.collection(`org/${orgId}/aiNotes`).doc();
    const eventRef = adminDb.collection(`org/${orgId}/aiNoteEvents`).doc();
    const ts = FieldValue.serverTimestamp();

    const batch = adminDb.batch();
    batch.set(notesRef, {
      title: title || null,
      content,
      status: 'open',
      source,
      createdBy: uid,
      createdByEmail: email,
      createdAt: ts,
      updatedBy: uid,
      updatedByEmail: email,
      updatedAt: ts,
    });
    batch.set(eventRef, {
      noteId: notesRef.id,
      action: 'created',
      fromStatus: null,
      toStatus: 'open',
      performedBy: uid,
      performedByEmail: email,
      performedAt: ts,
      details: {
        source,
      },
    });

    await batch.commit();

    await writeAuditLog(orgId, {
      action: 'ai.note_created',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'aiNote',
      entityId: notesRef.id,
      details: {
        source,
      },
    });

    return { noteId: notesRef.id };
  },
);
