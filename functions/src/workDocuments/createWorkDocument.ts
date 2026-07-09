import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscription } from '../utils/subscription.js';
import { throwInvalidArgument } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
import {
  assertAiAssistantEnabled,
  sanitizeText,
  sanitizeWorkDocumentCategory,
  sanitizeWorkDocumentSchema,
  sanitizeWorkDocumentStatus,
  sanitizeWorkDocumentType,
} from './workDocumentValidation.js';

interface CreateWorkDocumentInput {
  orgId: string;
  title: string;
  description?: string | null;
  type?: 'checksheet' | 'procedure' | 'reference';
  category?: string;
  status?: 'draft' | 'active' | 'archived';
  schema?: Record<string, unknown>;
  source?: 'ai_generated' | 'manual' | 'template';
  relatedLocationId?: string | null;
  relatedLocationLabel?: string | null;
}

interface CreateWorkDocumentResult {
  documentId: string;
}

export const createWorkDocument = onCall<
  CreateWorkDocumentInput,
  Promise<CreateWorkDocumentResult>
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

  const title = sanitizeText(request.data.title, 200);
  if (!title) {
    throwInvalidArgument('Document title is required.');
  }

  const description = sanitizeText(request.data.description, 2000) || null;
  const type = sanitizeWorkDocumentType(request.data.type);
  const category = sanitizeWorkDocumentCategory(request.data.category);
  const status = sanitizeWorkDocumentStatus(request.data.status);
  const schema = sanitizeWorkDocumentSchema(request.data.schema);
  const source =
    request.data.source === 'ai_generated' || request.data.source === 'template'
      ? request.data.source
      : 'manual';
  const relatedLocationId =
    sanitizeText(request.data.relatedLocationId, 128) || null;
  const relatedLocationLabel =
    sanitizeText(request.data.relatedLocationLabel, 200) || null;

  const docRef = adminDb.collection(`org/${orgId}/workDocuments`).doc();
  const ts = FieldValue.serverTimestamp();

  await docRef.set({
    title,
    description,
    type,
    category,
    status,
    schema,
    source,
    relatedLocationId,
    relatedLocationLabel,
    createdBy: uid,
    createdByEmail: email,
    createdAt: ts,
    updatedBy: uid,
    updatedByEmail: email,
    updatedAt: ts,
  });

  await writeAuditLog(orgId, {
    action: 'work_document.created',
    performedBy: uid,
    performedByEmail: email,
    entityType: 'workDocument',
    entityId: docRef.id,
    details: {
      source,
      category,
      type,
    },
  });

  return { documentId: docRef.id };
});
