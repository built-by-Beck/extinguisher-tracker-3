import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';
import type {
  WorkDocument,
  WorkDocumentCategory,
  WorkDocumentSchema,
  WorkDocumentStatus,
  WorkDocumentType,
} from '../types/workDocument.ts';

export interface CreateWorkDocumentInput {
  orgId: string;
  title: string;
  description?: string | null;
  type?: WorkDocumentType;
  category?: WorkDocumentCategory;
  status?: WorkDocumentStatus;
  schema?: WorkDocumentSchema;
  source?: 'ai_generated' | 'manual' | 'template';
  relatedLocationId?: string | null;
  relatedLocationLabel?: string | null;
}

interface CreateWorkDocumentResult {
  documentId: string;
}

export interface UpdateWorkDocumentInput {
  orgId: string;
  documentId: string;
  title?: string;
  description?: string | null;
  type?: WorkDocumentType;
  category?: WorkDocumentCategory;
  status?: WorkDocumentStatus;
  schema?: WorkDocumentSchema;
  relatedLocationId?: string | null;
  relatedLocationLabel?: string | null;
}

interface UpdateWorkDocumentResult {
  success: boolean;
}

function normalizeWorkDocument(docSnap: {
  id: string;
  data: () => Record<string, unknown>;
}): WorkDocument {
  const data = docSnap.data();
  const schema = (data.schema as WorkDocument['schema']) ?? {
    sections: [],
    printNotes: null,
    footerText: null,
  };

  return {
    id: docSnap.id,
    title: (data.title as string) ?? 'Untitled',
    description: (data.description as string | null) ?? null,
    type: (data.type as WorkDocument['type']) ?? 'checksheet',
    category: (data.category as WorkDocument['category']) ?? 'general',
    status: (data.status as WorkDocument['status']) ?? 'active',
    schema,
    source: (data.source as WorkDocument['source']) ?? 'manual',
    relatedLocationId: (data.relatedLocationId as string | null) ?? null,
    relatedLocationLabel: (data.relatedLocationLabel as string | null) ?? null,
    createdBy: (data.createdBy as string) ?? '',
    createdByEmail: (data.createdByEmail as string | null) ?? null,
    createdAt: data.createdAt,
    updatedBy: (data.updatedBy as string) ?? '',
    updatedByEmail: (data.updatedByEmail as string | null) ?? null,
    updatedAt: data.updatedAt,
  };
}

export function subscribeToWorkDocuments(
  orgId: string,
  callback: (documents: WorkDocument[]) => void,
  maxItems = 100,
): () => void {
  const q = query(
    collection(db, 'org', orgId, 'workDocuments'),
    orderBy('updatedAt', 'desc'),
    limit(maxItems),
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((docSnap) => normalizeWorkDocument(docSnap)));
  });
}

export function subscribeToWorkDocument(
  orgId: string,
  documentId: string,
  callback: (document: WorkDocument | null) => void,
): () => void {
  return onSnapshot(doc(db, 'org', orgId, 'workDocuments', documentId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(normalizeWorkDocument(snap));
  });
}

export async function createWorkDocumentCall(
  input: CreateWorkDocumentInput,
): Promise<CreateWorkDocumentResult> {
  const fn = httpsCallable<CreateWorkDocumentInput, CreateWorkDocumentResult>(
    functions,
    'createWorkDocument',
  );
  const result = await fn(input);
  return result.data;
}

export async function updateWorkDocumentCall(
  input: UpdateWorkDocumentInput,
): Promise<UpdateWorkDocumentResult> {
  const fn = httpsCallable<UpdateWorkDocumentInput, UpdateWorkDocumentResult>(
    functions,
    'updateWorkDocument',
  );
  const result = await fn(input);
  return result.data;
}
