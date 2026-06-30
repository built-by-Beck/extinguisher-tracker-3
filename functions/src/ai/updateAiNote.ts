import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import {
  throwInvalidArgument,
  throwNotFound,
  throwPermissionDenied,
} from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';
import {
  assertAiAssistantEnabled,
  sanitizeCategory,
  sanitizeEntityType,
  sanitizePriority,
  sanitizeStatus,
  sanitizeTags,
  sanitizeText,
  type AiNoteStatus,
  type NoteCategory,
  type NotePriority,
  type NoteRelatedEntityType,
} from './aiNoteValidation.js';

interface UpdateAiNoteInput {
  orgId: string;
  noteId: string;
  title?: string | null;
  content?: string;
  status?: AiNoteStatus;
  category?: NoteCategory | null;
  tags?: string[];
  priority?: NotePriority | null;
  relatedEntityType?: NoteRelatedEntityType | null;
  relatedEntityId?: string | null;
  relatedEntityLabel?: string | null;
  pinned?: boolean;
}

interface UpdateAiNoteResult {
  success: boolean;
}

function canEditNote(
  role: string | undefined,
  uid: string,
  createdBy: string | undefined,
): boolean {
  if (role === 'owner' || role === 'admin') return true;
  return createdBy === uid;
}

export const updateAiNote = onCall<
  UpdateAiNoteInput,
  Promise<UpdateAiNoteResult>
>({ enforceAppCheck: false }, async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, noteId } = request.data;

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }
  if (!noteId || typeof noteId !== 'string') {
    throwInvalidArgument('Note ID is required.');
  }

  const membership = await validateMembership(orgId, uid, [
    'owner',
    'admin',
    'inspector',
  ]);

  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  assertAiAssistantEnabled(orgSnap.data());

  const noteRef = adminDb.doc(`org/${orgId}/aiNotes/${noteId}`);
  const eventRef = adminDb.collection(`org/${orgId}/aiNoteEvents`).doc();

  await adminDb.runTransaction(async (tx) => {
    await validateSubscriptionTx(tx, orgId);
    const noteSnap = await tx.get(noteRef);

    if (!noteSnap.exists) {
      throwNotFound('AI note not found.');
    }

    const createdBy = noteSnap.get('createdBy') as string | undefined;
    if (!canEditNote(membership.role, uid, createdBy)) {
      throwPermissionDenied('You can only edit your own notes.');
    }

    const updates: Record<string, unknown> = {};
    const details: Record<string, unknown> = {};

    if (request.data.title !== undefined) {
      const title = sanitizeText(request.data.title, 120);
      updates.title = title || null;
      details.title = title || null;
    }

    if (request.data.content !== undefined) {
      const content = sanitizeText(request.data.content, 4000);
      if (!content) {
        throwInvalidArgument('Note content cannot be empty.');
      }
      updates.content = content;
      details.contentUpdated = true;
    }

    if (request.data.status !== undefined) {
      const status = sanitizeStatus(request.data.status);
      if (!status) {
        throwInvalidArgument('Status must be one of: open, in_progress, resolved.');
      }
      updates.status = status;
      details.status = status;
    }

    if (request.data.category !== undefined) {
      const category = sanitizeCategory(request.data.category);
      updates.category = category;
      details.category = category;
    }

    if (request.data.tags !== undefined) {
      const tags = sanitizeTags(request.data.tags);
      updates.tags = tags;
      details.tags = tags;
    }

    if (request.data.priority !== undefined) {
      const priority = sanitizePriority(request.data.priority);
      updates.priority = priority;
      details.priority = priority;
    }

    if (request.data.relatedEntityType !== undefined) {
      const relatedEntityType = sanitizeEntityType(
        request.data.relatedEntityType,
      );
      updates.relatedEntityType = relatedEntityType;
      details.relatedEntityType = relatedEntityType;
    }

    if (request.data.relatedEntityId !== undefined) {
      const relatedEntityId = sanitizeText(request.data.relatedEntityId, 128);
      updates.relatedEntityId = relatedEntityId || null;
      details.relatedEntityId = relatedEntityId || null;
    }

    if (request.data.relatedEntityLabel !== undefined) {
      const relatedEntityLabel = sanitizeText(
        request.data.relatedEntityLabel,
        120,
      );
      updates.relatedEntityLabel = relatedEntityLabel || null;
      details.relatedEntityLabel = relatedEntityLabel || null;
    }

    if (request.data.pinned !== undefined) {
      updates.pinned = request.data.pinned === true;
      details.pinned = request.data.pinned === true;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    const ts = FieldValue.serverTimestamp();
    updates.updatedBy = uid;
    updates.updatedByEmail = email;
    updates.updatedAt = ts;

    tx.update(noteRef, updates);
    tx.set(eventRef, {
      noteId,
      action: 'updated',
      fromStatus: (noteSnap.get('status') as AiNoteStatus | undefined) ?? null,
      toStatus: (updates.status as AiNoteStatus | undefined) ??
        (noteSnap.get('status') as AiNoteStatus | undefined) ??
        null,
      performedBy: uid,
      performedByEmail: email,
      performedAt: ts,
      details,
    });

    writeAuditLogTx(tx, orgId, {
      action: 'ai.note_updated',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'aiNote',
      entityId: noteId,
      details,
    });
  });

  return { success: true };
});
