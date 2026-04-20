export type AiMemoryIntentType =
  | 'list_notes_by_month'
  | 'list_expiring_by_year'
  | 'count_replacements_by_month';

export interface MonthWindow {
  year: number;
  month: number;
  startIso: string;
  endIso: string;
  label: string;
}

export interface AiMemoryQueryIntent {
  type: AiMemoryIntentType;
  noteStatus?: 'open' | 'in_progress' | 'resolved';
  monthWindow?: MonthWindow;
  targetYear?: number;
}

export interface AiMemoryNoteResult {
  id: string;
  title: string | null;
  content: string;
  status: 'open' | 'in_progress' | 'resolved';
  source: 'manual' | 'ai_suggested';
  createdAt: string | null;
  updatedAt: string | null;
  createdByEmail: string | null;
}

export interface AiMemoryExpiringExtinguisher {
  id: string;
  assetId: string;
  serial: string;
  section: string;
  parentLocation: string;
  expirationYear: number | null;
  lifecycleStatus: string | null;
  complianceStatus: string | null;
}

export interface AiMemoryReplacementEvent {
  id: string;
  performedAt: string | null;
  performedByEmail: string | null;
  oldAssetId: string | null;
  newAssetId: string | null;
  oldExtinguisherId: string | null;
  newExtinguisherId: string | null;
  reason: string | null;
}

export interface AiMemoryQueryResponse {
  intentType: AiMemoryIntentType;
  appliedFilters: Record<string, string | number | boolean | null>;
  count: number;
  notes?: AiMemoryNoteResult[];
  expiringExtinguishers?: AiMemoryExpiringExtinguisher[];
  replacementEvents?: AiMemoryReplacementEvent[];
}
