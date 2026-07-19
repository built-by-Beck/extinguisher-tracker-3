import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscriptionTx } from '../utils/subscription.js';
import {
  throwInvalidArgument,
  throwNotFound,
  throwFailedPrecondition,
} from '../utils/errors.js';
import { writeAuditLogTx } from '../utils/auditLog.js';
import { assertAiAssistantEnabled, sanitizeText } from './aiNoteValidation.js';

interface ConvertNoteToInspectionInput {
  orgId: string;
  noteId: string;
  workspaceId?: string;
}

interface ConvertNoteToInspectionResult {
  success: boolean;
  inspectionId: string;
  assetId: string | null;
}

export const convertNoteToInspection = onCall<
  ConvertNoteToInspectionInput,
  Promise<ConvertNoteToInspectionResult>
>({ enforceAppCheck: false }, async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, noteId } = request.data;

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }
  if (!noteId || typeof noteId !== 'string') {
    throwInvalidArgument('Note ID is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin', 'inspector']);

  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  assertAiAssistantEnabled(orgSnap.data());

  const noteRef = adminDb.doc(`org/${orgId}/aiNotes/${noteId}`);
  const noteSnap = await noteRef.get();
  if (!noteSnap.exists) {
    throwNotFound('Note not found.');
  }

  const noteData = noteSnap.data()!;
  const assetLabel =
    sanitizeText(noteData.relatedEntityLabel, 120) ||
    sanitizeText(noteData.content, 120).match(/\b([A-Z]{1,5}-\d{2,})\b/i)?.[1] ||
    '';
  const workspaceId =
    sanitizeText(request.data.workspaceId, 128) ||
    sanitizeText(noteData.workspaceId, 128);

  if (!workspaceId) {
    throwInvalidArgument(
      'Workspace ID is required. Link this note to an active workspace first.',
    );
  }

  const workspaceSnap = await adminDb
    .doc(`org/${orgId}/workspaces/${workspaceId}`)
    .get();
  if (!workspaceSnap.exists || workspaceSnap.get('status') !== 'active') {
    throwFailedPrecondition('Workspace is not active.');
  }

  let extinguisherId = sanitizeText(noteData.relatedEntityId, 128);
  let assetId: string | null = assetLabel || null;

  if (!extinguisherId && assetLabel) {
    const extSnap = await adminDb
      .collection(`org/${orgId}/extinguishers`)
      .where('deletedAt', '==', null)
      .where('assetId', '==', assetLabel.toUpperCase())
      .limit(1)
      .get();
    if (!extSnap.empty) {
      extinguisherId = extSnap.docs[0].id;
      assetId = (extSnap.docs[0].get('assetId') as string | undefined) ?? assetLabel;
    }
  }

  if (!extinguisherId) {
    throwFailedPrecondition(
      'Could not find an extinguisher for this note. Add a linked asset label such as FE-042.',
    );
  }

  const inspectionSnap = await adminDb
    .collection(`org/${orgId}/inspections`)
    .where('extinguisherId', '==', extinguisherId)
    .where('workspaceId', '==', workspaceId)
    .limit(1)
    .get();

  if (inspectionSnap.empty) {
    throwNotFound(
      'No inspection checklist item found for this asset in the selected workspace.',
    );
  }

  const inspectionDoc = inspectionSnap.docs[0];
  const inspectionId = inspectionDoc.id;
  const existingNotes = sanitizeText(inspectionDoc.get('notes'), 2000);
  const noteContent = sanitizeText(noteData.content, 4000);
  const appendedNotes = [existingNotes, `[Floor note] ${noteContent}`]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);

  await adminDb.runTransaction(async (tx) => {
    await validateSubscriptionTx(tx, orgId);

    const ts = FieldValue.serverTimestamp();
    tx.update(inspectionDoc.ref, {
      status: 'fail',
      notes: appendedNotes,
      inspectedAt: ts,
      inspectedBy: uid,
      inspectedByEmail: email,
      updatedAt: ts,
    });

    tx.update(noteRef, {
      status: 'in_progress',
      relatedEntityType: 'extinguisher',
      relatedEntityId: extinguisherId,
      relatedEntityLabel: assetId,
      updatedBy: uid,
      updatedByEmail: email,
      updatedAt: ts,
    });

    writeAuditLogTx(tx, orgId, {
      action: 'ai.note_converted_to_inspection',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'aiNote',
      entityId: noteId,
      details: {
        inspectionId,
        extinguisherId,
        workspaceId,
      },
    });
  });

  return {
    success: true,
    inspectionId,
    assetId,
  };
});
