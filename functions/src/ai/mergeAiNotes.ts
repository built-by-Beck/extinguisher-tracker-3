import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import {
  throwInvalidArgument,
  throwNotFound,
} from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';
import { assertAiAssistantEnabled, sanitizeText } from './aiNoteValidation.js';

interface MergeAiNotesInput {
  orgId: string;
  targetNoteId: string;
  sourceNoteIds: string[];
}

interface MergeAiNotesResult {
  success: boolean;
  mergedCount: number;
}

export const mergeAiNotes = onCall<
  MergeAiNotesInput,
  Promise<MergeAiNotesResult>
>({ enforceAppCheck: false }, async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, targetNoteId } = request.data;
  const sourceNoteIds = Array.isArray(request.data.sourceNoteIds)
    ? request.data.sourceNoteIds.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      )
    : [];

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }
  if (!targetNoteId || typeof targetNoteId !== 'string') {
    throwInvalidArgument('Target note ID is required.');
  }
  if (sourceNoteIds.length === 0) {
    throwInvalidArgument('At least one source note ID is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin', 'inspector']);

  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  assertAiAssistantEnabled(orgSnap.data());

  const uniqueSourceIds = [...new Set(sourceNoteIds)].filter(
    (id) => id !== targetNoteId,
  );

  let mergedCount = 0;

  await adminDb.runTransaction(async (tx) => {
    await validateSubscriptionTx(tx, orgId);

    const targetRef = adminDb.doc(`org/${orgId}/aiNotes/${targetNoteId}`);
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists) {
      throwNotFound('Target note not found.');
    }

    const targetContent = sanitizeText(targetSnap.get('content'), 4000);
    const mergedSections: string[] = [targetContent];

    for (const sourceId of uniqueSourceIds) {
      const sourceRef = adminDb.doc(`org/${orgId}/aiNotes/${sourceId}`);
      const sourceSnap = await tx.get(sourceRef);
      if (!sourceSnap.exists) continue;

      const sourceContent = sanitizeText(sourceSnap.get('content'), 4000);
      if (sourceContent) {
        mergedSections.push(sourceContent);
      }

      const ts = FieldValue.serverTimestamp();
      tx.update(sourceRef, {
        status: 'resolved',
        mergedIntoNoteId: targetNoteId,
        updatedBy: uid,
        updatedByEmail: email,
        updatedAt: ts,
      });
      mergedCount += 1;
    }

    const mergedContent = mergedSections
      .filter(Boolean)
      .join('\n\n---\n\n')
      .slice(0, 4000);

    const ts = FieldValue.serverTimestamp();
    tx.update(targetRef, {
      content: mergedContent,
      updatedBy: uid,
      updatedByEmail: email,
      updatedAt: ts,
    });

    writeAuditLogTx(tx, orgId, {
      action: 'ai.notes_merged',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'aiNote',
      entityId: targetNoteId,
      details: {
        sourceNoteIds: uniqueSourceIds,
        mergedCount,
      },
    });
  });

  return { success: true, mergedCount };
});
