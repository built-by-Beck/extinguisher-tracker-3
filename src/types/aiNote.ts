export type AiNoteStatus = 'open' | 'in_progress' | 'resolved';

export interface AiNote {
  id: string;
  title: string | null;
  content: string;
  status: AiNoteStatus;
  source: 'manual' | 'ai_suggested';
  createdBy: string;
  createdByEmail: string | null;
  createdAt: unknown;
  updatedBy: string;
  updatedByEmail: string | null;
  updatedAt: unknown;
}
