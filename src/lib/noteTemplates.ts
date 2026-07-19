import type { NoteCategory } from '../types/aiNote.ts';

export interface NoteTemplate {
  id: string;
  label: string;
  content: string;
  category: NoteCategory;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blocked-access',
    label: 'Blocked access',
    content: 'Extinguisher access is blocked and needs to be cleared.',
    category: 'location',
  },
  {
    id: 'missing-pin',
    label: 'Missing pin',
    content: 'Safety pin is missing from the extinguisher.',
    category: 'maintenance',
  },
  {
    id: 'expired-tag',
    label: 'Expired tag',
    content: 'Inspection tag is expired or missing signature/date.',
    category: 'tagging',
  },
  {
    id: 'damaged-tag',
    label: 'Damaged tag',
    content: 'Asset tag is damaged or illegible.',
    category: 'tagging',
  },
  {
    id: 'low-pressure',
    label: 'Low pressure',
    content: 'Gauge shows undercharged or out of range pressure.',
    category: 'maintenance',
  },
  {
    id: 'replacement-candidate',
    label: 'Replacement candidate',
    content: 'Unit appears due for replacement based on age or condition.',
    category: 'replacement',
  },
  {
    id: 'vendor-follow-up',
    label: 'Vendor follow-up',
    content: 'Schedule vendor service follow-up for this unit.',
    category: 'follow_up',
  },
  {
    id: 'safety-hazard',
    label: 'Safety hazard',
    content: 'Immediate safety concern observed during floor walk.',
    category: 'safety',
  },
];
