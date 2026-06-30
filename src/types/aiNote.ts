export type AiNoteStatus = 'open' | 'in_progress' | 'resolved';

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

export interface AiNote {
  id: string;
  title: string | null;
  content: string;
  status: AiNoteStatus;
  source: 'manual' | 'ai_suggested';
  category: NoteCategory | null;
  tags: string[];
  priority: NotePriority | null;
  relatedEntityType: NoteRelatedEntityType | null;
  relatedEntityId: string | null;
  relatedEntityLabel: string | null;
  pinned: boolean;
  createdBy: string;
  createdByEmail: string | null;
  createdAt: unknown;
  updatedBy: string;
  updatedByEmail: string | null;
  updatedAt: unknown;
}

export interface AiNoteClassification {
  category: NoteCategory | null;
  priority: NotePriority | null;
  relatedEntityLabel: string | null;
  tags: string[];
}
