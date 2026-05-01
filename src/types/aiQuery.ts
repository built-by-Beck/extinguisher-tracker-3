export type AiMemoryIntentType =
  | 'list_notes_by_month'
  | 'list_expiring_by_year'
  | 'list_marked_expired'
  | 'list_expired_candidates'
  | 'count_replacements_by_month'
  | 'get_extinguisher_inspection_status';

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
  assetQuery?: string;
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
  manufactureYear: number | null;
  expirationYear: number | null;
  isExpired: boolean;
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

export interface AiMemoryInspectionStatusMatch {
  inspectionId: string;
  extinguisherId: string;
  assetId: string;
  status: string;
  section: string;
  workspaceId: string;
  workspaceLabel: string | null;
  inspectedAt: string | null;
  inspectedByEmail: string | null;
  notes: string;
}

export interface AiMemoryQueryResponse {
  intentType: AiMemoryIntentType;
  appliedFilters: Record<string, string | number | boolean | null>;
  count: number;
  notes?: AiMemoryNoteResult[];
  expiringExtinguishers?: AiMemoryExpiringExtinguisher[];
  expiredExtinguishers?: AiMemoryExpiringExtinguisher[];
  expiredCandidateExtinguishers?: AiMemoryExpiringExtinguisher[];
  replacementEvents?: AiMemoryReplacementEvent[];
  inspectionStatusMatches?: AiMemoryInspectionStatusMatch[];
}
