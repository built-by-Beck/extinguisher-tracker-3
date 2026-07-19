import type { NoteCategory, NotePriority } from '../types/aiNote.ts';

export const NOTE_CATEGORIES: NoteCategory[] = [
  'general',
  'compliance',
  'maintenance',
  'location',
  'tagging',
  'replacement',
  'follow_up',
  'safety',
];

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: 'General',
  compliance: 'Compliance',
  maintenance: 'Maintenance',
  location: 'Location',
  tagging: 'Tagging',
  replacement: 'Replacement',
  follow_up: 'Follow-up',
  safety: 'Safety',
};

export const NOTE_CATEGORY_COLORS: Record<NoteCategory, string> = {
  general: 'bg-gray-100 text-gray-700',
  compliance: 'bg-purple-100 text-purple-700',
  maintenance: 'bg-blue-100 text-blue-700',
  location: 'bg-cyan-100 text-cyan-700',
  tagging: 'bg-amber-100 text-amber-700',
  replacement: 'bg-orange-100 text-orange-700',
  follow_up: 'bg-indigo-100 text-indigo-700',
  safety: 'bg-red-100 text-red-700',
};

export const NOTE_PRIORITIES: NotePriority[] = ['low', 'normal', 'high'];

export const NOTE_PRIORITY_LABELS: Record<NotePriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

export const NOTE_PRIORITY_COLORS: Record<NotePriority, string> = {
  low: 'text-gray-500',
  normal: 'text-gray-700',
  high: 'text-red-600',
};

export const NOTE_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
} as const;
