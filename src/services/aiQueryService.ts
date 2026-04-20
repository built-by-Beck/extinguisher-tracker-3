import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase.ts';
import type { AiMemoryQueryIntent, AiMemoryQueryResponse } from '../types/aiQuery.ts';

interface QueryAiMemoryInput {
  orgId: string;
  intent: AiMemoryQueryIntent;
}

export async function queryAiMemoryCall(
  input: QueryAiMemoryInput,
): Promise<AiMemoryQueryResponse> {
  const fn = httpsCallable<QueryAiMemoryInput, AiMemoryQueryResponse>(functions, 'queryAiMemory');
  const result = await fn(input);
  return result.data;
}
