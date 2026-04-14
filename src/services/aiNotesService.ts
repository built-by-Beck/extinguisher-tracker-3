import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';
import type { AiNote, AiNoteStatus } from '../types/aiNote.ts';

interface CreateAiNoteInput {
  orgId: string;
  content: string;
  title?: string;
  source?: 'manual' | 'ai_suggested';
}

interface CreateAiNoteResult {
  noteId: string;
}

interface UpdateAiNoteStatusInput {
  orgId: string;
  noteId: string;
  status: AiNoteStatus;
}

interface UpdateAiNoteStatusResult {
  success: boolean;
}

export function subscribeToAiNotes(
  orgId: string,
  callback: (notes: AiNote[]) => void,
  maxItems = 20,
): () => void {
  const q = query(
    collection(db, 'org', orgId, 'aiNotes'),
    orderBy('updatedAt', 'desc'),
    limit(maxItems),
  );

  return onSnapshot(q, (snap) => {
    const notes = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as AiNote[];
    callback(notes);
  });
}

export async function createAiNoteCall(input: CreateAiNoteInput): Promise<CreateAiNoteResult> {
  const fn = httpsCallable<CreateAiNoteInput, CreateAiNoteResult>(functions, 'createAiNote');
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
