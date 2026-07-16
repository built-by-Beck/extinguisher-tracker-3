export type AiMemoryIntentType =
  | 'list_notes_by_month'
  | 'list_notes_by_category'
  | 'list_notes_by_asset'
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
  noteCategory?: string;
  assetQuery?: string;
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
  locationName: string;
  vicinity: string;
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
  serial: string;
  parentLocation: string;
  locationName: string;
  vicinity: string;
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
