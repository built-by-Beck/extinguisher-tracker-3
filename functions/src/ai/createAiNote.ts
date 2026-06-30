import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscription } from '../utils/subscription.js';
import {
  throwInvalidArgument,
} from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
import {
  assertAiAssistantEnabled,
  sanitizeCategory,
  sanitizeEntityType,
  sanitizePriority,
  sanitizeTags,
  sanitizeText,
  type NoteCategory,
  type NotePriority,
  type NoteRelatedEntityType,
} from './aiNoteValidation.js';

interface CreateAiNoteInput {
  orgId: string;
  content: string;
  title?: string;
  source?: 'manual' | 'ai_suggested';
  category?: NoteCategory | null;
  tags?: string[];
  priority?: NotePriority | null;
  relatedEntityType?: NoteRelatedEntityType | null;
  relatedEntityId?: string | null;
  relatedEntityLabel?: string | null;
  pinned?: boolean;
}

interface CreateAiNoteResult {
  noteId: string;
}

export const createAiNote = onCall<
  CreateAiNoteInput,
  Promise<CreateAiNoteResult>
>({ enforceAppCheck: false }, async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId } = request.data;

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin', 'inspector']);
  await validateSubscription(orgId);

  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  assertAiAssistantEnabled(orgSnap.data());

  const content = sanitizeText(request.data.content, 4000);
  const title = sanitizeText(request.data.title, 120);
  const source =
    request.data.source === 'ai_suggested' ? 'ai_suggested' : 'manual';
  const category = sanitizeCategory(request.data.category);
  const tags = sanitizeTags(request.data.tags);
  const priority = sanitizePriority(request.data.priority);
  const relatedEntityType = sanitizeEntityType(request.data.relatedEntityType);
  const relatedEntityId = sanitizeText(request.data.relatedEntityId, 128);
  const relatedEntityLabel = sanitizeText(
    request.data.relatedEntityLabel,
    120,
  );
  const pinned = request.data.pinned === true;

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
    category,
    tags,
    priority,
    relatedEntityType,
    relatedEntityId: relatedEntityId || null,
    relatedEntityLabel: relatedEntityLabel || null,
    pinned,
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
      category,
      priority,
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
      category,
      priority,
    },
  });

  return { noteId: notesRef.id };
});
