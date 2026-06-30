import type { AiNote } from '../types/aiNote.ts';
import { NOTE_CATEGORY_LABELS, NOTE_STATUS_LABELS } from './aiNoteConstants.ts';

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(timestamp: unknown): string {
  if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: () => Date }).toDate === 'function'
  ) {
    return (timestamp as { toDate: () => Date }).toDate().toISOString();
  }
  return '';
}

export function exportNotesToCsv(notes: AiNote[]): string {
  const headers = [
    'id',
    'title',
    'content',
    'status',
    'category',
    'priority',
    'tags',
    'relatedEntityLabel',
    'workspaceLabel',
    'pinned',
    'createdByEmail',
    'createdAt',
    'updatedAt',
    'photoUrl',
  ];

  const rows = notes.map((note) =>
    [
      note.id,
      note.title ?? '',
      note.content,
      NOTE_STATUS_LABELS[note.status],
      note.category ? NOTE_CATEGORY_LABELS[note.category] : '',
      note.priority ?? '',
      note.tags.join('; '),
      note.relatedEntityLabel ?? '',
      note.workspaceLabel ?? '',
      note.pinned ? 'yes' : 'no',
      note.createdByEmail ?? '',
      formatDate(note.createdAt),
      formatDate(note.updatedAt),
      note.photoUrl ?? '',
    ]
      .map(escapeCsv)
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

export function downloadNotesCsv(notes: AiNote[], orgName = 'organization'): void {
  const csv = exportNotesToCsv(notes);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = orgName.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  link.href = url;
  link.download = `${safeName}-notes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
