import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';
import { queueAiNote } from './offlineSyncService.ts';
import type {
  AiNote,
  AiNoteStatus,
  NoteCategory,
  NotePriority,
  NoteRelatedEntityType,
} from '../types/aiNote.ts';

export interface CreateAiNoteInput {
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
  photoUrl?: string | null;
  photoPath?: string | null;
  workspaceId?: string | null;
  workspaceLabel?: string | null;
}

interface CreateAiNoteResult {
  noteId: string;
}

export interface UpdateAiNoteInput {
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
  photoUrl?: string | null;
  photoPath?: string | null;
  workspaceId?: string | null;
  workspaceLabel?: string | null;
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

interface MergeAiNotesInput {
  orgId: string;
  targetNoteId: string;
  sourceNoteIds: string[];
}

interface MergeAiNotesResult {
  success: boolean;
  mergedCount: number;
}

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

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('offline') ||
    msg.includes('internet')
  );
}

function normalizeNote(docSnap: {
  id: string;
  data: () => Record<string, unknown>;
}): AiNote {
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
    photoUrl: (data.photoUrl as string | null) ?? null,
    photoPath: (data.photoPath as string | null) ?? null,
    workspaceId: (data.workspaceId as string | null) ?? null,
    workspaceLabel: (data.workspaceLabel as string | null) ?? null,
    mergedIntoNoteId: (data.mergedIntoNoteId as string | null) ?? null,
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

export async function mergeAiNotesCall(
  input: MergeAiNotesInput,
): Promise<MergeAiNotesResult> {
  const fn = httpsCallable<MergeAiNotesInput, MergeAiNotesResult>(
    functions,
    'mergeAiNotes',
  );
  const result = await fn(input);
  return result.data;
}

export async function convertNoteToInspectionCall(
  input: ConvertNoteToInspectionInput,
): Promise<ConvertNoteToInspectionResult> {
  const fn = httpsCallable<
    ConvertNoteToInspectionInput,
    ConvertNoteToInspectionResult
  >(functions, 'convertNoteToInspection');
  const result = await fn(input);
  return result.data;
}

export async function createAiNoteOfflineAware(
  input: CreateAiNoteInput,
  isOnline: boolean,
  photoDataUrl?: string | null,
  photoMimeType?: string | null,
): Promise<{ synced: boolean; queueId?: string; noteId?: string }> {
  if (isOnline) {
    try {
      const { noteId } = await createAiNoteCall(input);
      return { synced: true, noteId };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const queueId = await queueAiNote({
    orgId: input.orgId,
    operation: 'create',
    payload: input as unknown as Record<string, unknown>,
    photoDataUrl: photoDataUrl ?? null,
    photoMimeType: photoMimeType ?? null,
    queuedAt: Date.now(),
  });
  return { synced: false, queueId };
}

export async function updateAiNoteOfflineAware(
  input: UpdateAiNoteInput,
  isOnline: boolean,
): Promise<{ synced: boolean; queueId?: string }> {
  if (isOnline) {
    try {
      await updateAiNoteCall(input);
      return { synced: true };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const queueId = await queueAiNote({
    orgId: input.orgId,
    operation: 'update',
    noteId: input.noteId,
    payload: input as unknown as Record<string, unknown>,
    queuedAt: Date.now(),
  });
  return { synced: false, queueId };
}
