import { throwPermissionDenied } from '../utils/errors.js';

export type NoteCategory =
  | 'general'
  | 'compliance'
  | 'maintenance'
  | 'location'
  | 'tagging'
  | 'replacement'
  | 'follow_up'
  | 'safety';

export type NotePriority = 'low' | 'normal' | 'high';

export type NoteRelatedEntityType =
  | 'extinguisher'
  | 'location'
  | 'workspace'
  | 'asset';

export type AiNoteStatus = 'open' | 'in_progress' | 'resolved';

export const VALID_CATEGORIES: NoteCategory[] = [
  'general',
  'compliance',
  'maintenance',
  'location',
  'tagging',
  'replacement',
  'follow_up',
  'safety',
];

export const VALID_PRIORITIES: NotePriority[] = ['low', 'normal', 'high'];

export const VALID_ENTITY_TYPES: NoteRelatedEntityType[] = [
  'extinguisher',
  'location',
  'workspace',
  'asset',
];

export const VALID_STATUSES: AiNoteStatus[] = [
  'open',
  'in_progress',
  'resolved',
];

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function sanitizeCategory(value: unknown): NoteCategory | null {
  if (typeof value !== 'string') return null;
  return VALID_CATEGORIES.includes(value as NoteCategory)
    ? (value as NoteCategory)
    : null;
}

export function sanitizePriority(value: unknown): NotePriority | null {
  if (typeof value !== 'string') return null;
  return VALID_PRIORITIES.includes(value as NotePriority)
    ? (value as NotePriority)
    : null;
}

export function sanitizeEntityType(
  value: unknown,
): NoteRelatedEntityType | null {
  if (typeof value !== 'string') return null;
  return VALID_ENTITY_TYPES.includes(value as NoteRelatedEntityType)
    ? (value as NoteRelatedEntityType)
    : null;
}

export function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 5);
}

export function sanitizeStatus(value: unknown): AiNoteStatus | null {
  if (typeof value !== 'string') return null;
  return VALID_STATUSES.includes(value as AiNoteStatus)
    ? (value as AiNoteStatus)
    : null;
}

export function sanitizeOptionalUrl(value: unknown, maxLength = 2048): string | null {
  const text = sanitizeText(value, maxLength);
  return text || null;
}

export function assertAiAssistantEnabled(
  orgData: FirebaseFirestore.DocumentData | undefined,
): void {
  const plan = typeof orgData?.plan === 'string' ? orgData.plan : null;
  const featureEnabled = orgData?.featureFlags?.aiAssistant === true;
  const hasAiAssistant =
    featureEnabled || ['pro', 'elite', 'enterprise'].includes(plan ?? '');
  if (!hasAiAssistant) {
    throwPermissionDenied('AI assistant is not enabled for this organization.');
  }
}
