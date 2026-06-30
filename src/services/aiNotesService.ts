import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';
import type {
  AiNote,
  AiNoteStatus,
  NoteCategory,
  NotePriority,
  NoteRelatedEntityType,
} from '../types/aiNote.ts';

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

interface UpdateAiNoteStatusInput {
  orgId: string;
  noteId: string;
  status: AiNoteStatus;
}

interface UpdateAiNoteStatusResult {
  success: boolean;
}

function normalizeNote(docSnap: { id: string; data: () => Record<string, unknown> }): AiNote {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: (data.title as string | null) ?? null,
    content: (data.content as string) ?? '',
    status: (data.status as AiNoteStatus) ?? 'open',
    source: (data.source as 'manual' | 'ai_suggested') ?? 'manual',
    category: (data.category as NoteCategory | null) ?? null,
    tags: Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    priority: (data.priority as NotePriority | null) ?? null,
    relatedEntityType:
      (data.relatedEntityType as NoteRelatedEntityType | null) ?? null,
    relatedEntityId: (data.relatedEntityId as string | null) ?? null,
    relatedEntityLabel: (data.relatedEntityLabel as string | null) ?? null,
    pinned: data.pinned === true,
    createdBy: (data.createdBy as string) ?? '',
    createdByEmail: (data.createdByEmail as string | null) ?? null,
    createdAt: data.createdAt,
    updatedBy: (data.updatedBy as string) ?? '',
    updatedByEmail: (data.updatedByEmail as string | null) ?? null,
    updatedAt: data.updatedAt,
  };
}

export function subscribeToAiNotes(
  orgId: string,
  callback: (notes: AiNote[]) => void,
  maxItems = 100,
): () => void {
  const q = query(
    collection(db, 'org', orgId, 'aiNotes'),
    orderBy('updatedAt', 'desc'),
    limit(maxItems),
  );

  return onSnapshot(q, (snap) => {
    const notes = snap.docs.map((docSnap) => normalizeNote(docSnap));
    callback(notes);
  });
}

export async function createAiNoteCall(
  input: CreateAiNoteInput,
): Promise<CreateAiNoteResult> {
  const fn = httpsCallable<CreateAiNoteInput, CreateAiNoteResult>(
    functions,
    'createAiNote',
  );
  const result = await fn(input);
  return result.data;
}

export async function updateAiNoteCall(
  input: UpdateAiNoteInput,
): Promise<UpdateAiNoteResult> {
  const fn = httpsCallable<UpdateAiNoteInput, UpdateAiNoteResult>(
    functions,
    'updateAiNote',
  );
  const result = await fn(input);
  return result.data;
}

export async function updateAiNoteStatusCall(
  input: UpdateAiNoteStatusInput,
): Promise<UpdateAiNoteStatusResult> {
  const fn = httpsCallable<UpdateAiNoteStatusInput, UpdateAiNoteStatusResult>(
    functions,
    'updateAiNoteStatus',
  );
  const result = await fn(input);
  return result.data;
}
