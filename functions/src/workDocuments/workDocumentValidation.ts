import { throwPermissionDenied } from '../utils/errors.js';

export type WorkDocumentType = 'checksheet' | 'procedure' | 'reference';
export type WorkDocumentCategory =
  | 'egress_lighting'
  | 'stairwell'
  | 'exit_path'
  | 'general'
  | 'custom';
export type WorkDocumentStatus = 'draft' | 'active' | 'archived';
export type WorkDocumentFieldType =
  | 'pass_fail'
  | 'yes_no'
  | 'text'
  | 'checkbox'
  | 'number';

const VALID_TYPES: WorkDocumentType[] = ['checksheet', 'procedure', 'reference'];
const VALID_CATEGORIES: WorkDocumentCategory[] = [
  'egress_lighting',
  'stairwell',
  'exit_path',
  'general',
  'custom',
];
const VALID_STATUSES: WorkDocumentStatus[] = ['draft', 'active', 'archived'];
const VALID_FIELD_TYPES: WorkDocumentFieldType[] = [
  'pass_fail',
  'yes_no',
  'text',
  'checkbox',
  'number',
];

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeField(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const field = value as Record<string, unknown>;
  const key = sanitizeText(field.key, 80);
  const label = sanitizeText(field.label, 200);
  const type = VALID_FIELD_TYPES.includes(field.type as WorkDocumentFieldType)
    ? (field.type as WorkDocumentFieldType)
    : 'pass_fail';
  if (!key || !label) return null;
  return {
    key,
    label,
    type,
    required: field.required === true,
  };
}

function sanitizeItem(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = sanitizeText(item.id, 80) || crypto.randomUUID();
  const label = sanitizeText(item.label, 200);
  if (!label) return null;
  const fields = Array.isArray(item.fields)
    ? item.fields
        .map(sanitizeField)
        .filter((f): f is Record<string, unknown> => f !== null)
        .slice(0, 12)
    : [];
  const meta =
    item.meta && typeof item.meta === 'object' && !Array.isArray(item.meta)
      ? Object.fromEntries(
          Object.entries(item.meta as Record<string, unknown>)
            .slice(0, 10)
            .map(([k, v]) => [
              sanitizeText(k, 40),
              typeof v === 'number' || typeof v === 'boolean'
                ? v
                : sanitizeText(v, 120) || null,
            ]),
        )
      : {};
  return {
    id,
    label,
    locationId: sanitizeText(item.locationId, 128) || null,
    locationType: sanitizeText(item.locationType, 40) || null,
    meta,
    fields,
  };
}

function sanitizeSection(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const section = value as Record<string, unknown>;
  const id = sanitizeText(section.id, 80) || crypto.randomUUID();
  const title = sanitizeText(section.title, 200);
  if (!title) return null;
  const items = Array.isArray(section.items)
    ? section.items
        .map(sanitizeItem)
        .filter((i): i is Record<string, unknown> => i !== null)
        .slice(0, 100)
    : [];
  return {
    id,
    title,
    description: sanitizeText(section.description, 500) || null,
    items,
  };
}

export function sanitizeWorkDocumentSchema(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { sections: [], printNotes: null, footerText: null };
  }
  const schema = value as Record<string, unknown>;
  const sections = Array.isArray(schema.sections)
    ? schema.sections
        .map(sanitizeSection)
        .filter((s): s is Record<string, unknown> => s !== null)
        .slice(0, 20)
    : [];
  return {
    sections,
    printNotes: sanitizeText(schema.printNotes, 2000) || null,
    footerText: sanitizeText(schema.footerText, 500) || null,
  };
}

export function sanitizeWorkDocumentType(value: unknown): WorkDocumentType {
  return VALID_TYPES.includes(value as WorkDocumentType)
    ? (value as WorkDocumentType)
    : 'checksheet';
}

export function sanitizeWorkDocumentCategory(
  value: unknown,
): WorkDocumentCategory {
  return VALID_CATEGORIES.includes(value as WorkDocumentCategory)
    ? (value as WorkDocumentCategory)
    : 'general';
}

export function sanitizeWorkDocumentStatus(
  value: unknown,
): WorkDocumentStatus {
  return VALID_STATUSES.includes(value as WorkDocumentStatus)
    ? (value as WorkDocumentStatus)
    : 'active';
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
