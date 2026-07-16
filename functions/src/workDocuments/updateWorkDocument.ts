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
  sanitizeText,
  sanitizeWorkDocumentCategory,
  sanitizeWorkDocumentSchema,
  sanitizeWorkDocumentStatus,
  sanitizeWorkDocumentType,
} from './workDocumentValidation.js';

interface UpdateWorkDocumentInput {
  orgId: string;
  documentId: string;
  title?: string;
  description?: string | null;
  type?: 'checksheet' | 'procedure' | 'reference';
  category?: string;
  status?: 'draft' | 'active' | 'archived';
  schema?: Record<string, unknown>;
  relatedLocationId?: string | null;
  relatedLocationLabel?: string | null;
}

interface UpdateWorkDocumentResult {
  success: boolean;
}

function canEditDocument(
  role: string | undefined,
  uid: string,
  createdBy: string | undefined,
): boolean {
  if (role === 'owner' || role === 'admin') return true;
  return createdBy === uid;
}

export const updateWorkDocument = onCall<
  UpdateWorkDocumentInput,
  Promise<UpdateWorkDocumentResult>
>({ enforceAppCheck: false }, async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, documentId } = request.data;

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }
  if (!documentId || typeof documentId !== 'string') {
    throwInvalidArgument('Document ID is required.');
  }

  const membership = await validateMembership(orgId, uid, [
    'owner',
    'admin',
    'inspector',
  ]);

  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  assertAiAssistantEnabled(orgSnap.data());

  const docRef = adminDb.doc(`org/${orgId}/workDocuments/${documentId}`);

  await adminDb.runTransaction(async (tx) => {
    await validateSubscriptionTx(tx, orgId);
    const docSnap = await tx.get(docRef);

    if (!docSnap.exists) {
      throwNotFound('Work document not found.');
    }

    const createdBy = docSnap.get('createdBy') as string | undefined;
    if (!canEditDocument(membership.role, uid, createdBy)) {
      throwPermissionDenied('You can only edit your own work documents.');
    }

    const updates: Record<string, unknown> = {};
    const details: Record<string, unknown> = {};

    if (request.data.title !== undefined) {
      const title = sanitizeText(request.data.title, 200);
      if (!title) {
        throwInvalidArgument('Document title cannot be empty.');
      }
      updates.title = title;
      details.title = title;
    }

    if (request.data.description !== undefined) {
      updates.description =
        sanitizeText(request.data.description, 2000) || null;
    }

    if (request.data.type !== undefined) {
      updates.type = sanitizeWorkDocumentType(request.data.type);
    }

    if (request.data.category !== undefined) {
      updates.category = sanitizeWorkDocumentCategory(request.data.category);
    }

    if (request.data.status !== undefined) {
      updates.status = sanitizeWorkDocumentStatus(request.data.status);
    }

    if (request.data.schema !== undefined) {
      updates.schema = sanitizeWorkDocumentSchema(request.data.schema);
    }

    if (request.data.relatedLocationId !== undefined) {
      updates.relatedLocationId =
        sanitizeText(request.data.relatedLocationId, 128) || null;
    }

    if (request.data.relatedLocationLabel !== undefined) {
      updates.relatedLocationLabel =
        sanitizeText(request.data.relatedLocationLabel, 200) || null;
    }

    if (Object.keys(updates).length === 0) {
      throwInvalidArgument('No updates provided.');
    }

    updates.updatedBy = uid;
    updates.updatedByEmail = email;
    updates.updatedAt = FieldValue.serverTimestamp();

    tx.update(docRef, updates);

    await writeAuditLogTx(tx, orgId, {
      action: 'work_document.updated',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'workDocument',
      entityId: documentId,
      details,
    });
  });

  return { success: true };
});
