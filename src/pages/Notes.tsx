/**
 * Notes page — org-scoped floor-walk notes with classification and AI suggestions.
 * Route: /dashboard/notes
 *
 * Author: built_by_Beck
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Pin,
  PinOff,
  Loader2,
  X,
  Lightbulb,
  Check,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useAiAssistant } from '../contexts/AiAssistantContext.tsx';
import {
  createAiNoteCall,
  subscribeToAiNotes,
  updateAiNoteCall,
} from '../services/aiNotesService.ts';
import {
  suggestNoteOrganization,
  type NoteOrganizationSuggestion,
} from '../services/aiNoteOrganizer.ts';
import type {
  AiNote,
  AiNoteStatus,
  NoteCategory,
  NotePriority,
} from '../types/aiNote.ts';
import {
  NOTE_CATEGORIES,
  NOTE_CATEGORY_COLORS,
  NOTE_CATEGORY_LABELS,
  NOTE_PRIORITIES,
  NOTE_PRIORITY_LABELS,
  NOTE_STATUS_LABELS,
} from '../lib/aiNoteConstants.ts';

function formatTimestamp(timestamp: unknown): string {
  if (!timestamp) return '';
  try {
    let date: Date;
    if (
      typeof timestamp === 'object' &&
      timestamp !== null &&
      'toDate' in timestamp &&
      typeof (timestamp as { toDate: () => Date }).toDate === 'function'
    ) {
      date = (timestamp as { toDate: () => Date }).toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

interface NoteFormState {
  title: string;
  content: string;
  status: AiNoteStatus;
  category: NoteCategory | '';
  priority: NotePriority | '';
  tags: string;
  relatedEntityLabel: string;
  pinned: boolean;
}

const EMPTY_FORM: NoteFormState = {
  title: '',
  content: '',
  status: 'open',
  category: '',
  priority: 'normal',
  tags: '',
  relatedEntityLabel: '',
  pinned: false,
};

export default function Notes() {
  const { userProfile } = useAuth();
  const { hasRole } = useOrg();
  const { openAssistant } = useAiAssistant();
  const orgId = userProfile?.activeOrgId ?? '';
  const canManageNotes = hasRole(['owner', 'admin', 'inspector']);

  const [notes, setNotes] = useState<AiNote[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AiNoteStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<NotePriority | ''>('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [hideResolved, setHideResolved] = useState(true);
  const [selectedNote, setSelectedNote] = useState<AiNote | null>(null);
  const [form, setForm] = useState<NoteFormState>(EMPTY_FORM);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NoteOrganizationSuggestion[]>(
    [],
  );
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<
    string | null
  >(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>(
    [],
  );

  useEffect(() => {
    if (!orgId) return;
    return subscribeToAiNotes(orgId, setNotes, 100);
  }, [orgId]);

  const authors = useMemo(() => {
    const unique = new Map<string, string>();
    for (const note of notes) {
      const label = note.createdByEmail ?? note.createdBy;
      if (label) unique.set(note.createdBy, label);
    }
    return [...unique.entries()];
  }, [notes]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes
      .filter((note) => {
        if (hideResolved && note.status === 'resolved') return false;
        if (statusFilter && note.status !== statusFilter) return false;
        if (categoryFilter && note.category !== categoryFilter) return false;
        if (priorityFilter && note.priority !== priorityFilter) return false;
        if (authorFilter && note.createdBy !== authorFilter) return false;
        if (!query) return true;
        const haystack = [
          note.title,
          note.content,
          note.relatedEntityLabel,
          ...(note.tags ?? []),
          note.createdByEmail,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return 0;
      });
  }, [
    notes,
    search,
    statusFilter,
    categoryFilter,
    priorityFilter,
    authorFilter,
    hideResolved,
  ]);

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
    setError(null);
  }

  function openEditModal(note: AiNote) {
    setSelectedNote(note);
    setForm({
      title: note.title ?? '',
      content: note.content,
      status: note.status,
      category: note.category ?? '',
      priority: note.priority ?? 'normal',
      tags: note.tags.join(', '),
      relatedEntityLabel: note.relatedEntityLabel ?? '',
      pinned: note.pinned,
    });
    setError(null);
  }

  function closeModal() {
    setCreateOpen(false);
    setSelectedNote(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSaveCreate() {
    if (!orgId || !form.content.trim()) {
      setError('Note content is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAiNoteCall({
        orgId,
        title: form.title.trim() || undefined,
        content: form.content.trim(),
        source: 'manual',
        category: form.category || null,
        priority: form.priority || null,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        relatedEntityLabel: form.relatedEntityLabel.trim() || null,
        relatedEntityType: form.relatedEntityLabel.trim()
          ? 'extinguisher'
          : null,
        pinned: form.pinned,
      });
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!orgId || !selectedNote || !form.content.trim()) {
      setError('Note content is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateAiNoteCall({
        orgId,
        noteId: selectedNote.id,
        title: form.title.trim() || null,
        content: form.content.trim(),
        status: form.status,
        category: form.category || null,
        priority: form.priority || null,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        relatedEntityLabel: form.relatedEntityLabel.trim() || null,
        relatedEntityType: form.relatedEntityLabel.trim()
          ? 'extinguisher'
          : null,
        pinned: form.pinned,
      });
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePin(note: AiNote) {
    if (!orgId || !canManageNotes) return;
    setBusyNoteId(note.id);
    try {
      await updateAiNoteCall({
        orgId,
        noteId: note.id,
        pinned: !note.pinned,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setBusyNoteId(null);
    }
  }

  async function handleQuickStatus(note: AiNote, status: AiNoteStatus) {
    if (!orgId || !canManageNotes) return;
    setBusyNoteId(note.id);
    try {
      await updateAiNoteCall({ orgId, noteId: note.id, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setBusyNoteId(null);
    }
  }

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    setError(null);
    try {
      const result = await suggestNoteOrganization(notes);
      setSuggestions(
        result.filter((item) => !dismissedSuggestions.includes(item.id)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load AI suggestions',
      );
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function applySuggestion(suggestion: NoteOrganizationSuggestion) {
    if (!orgId) return;
    setApplyingSuggestionId(suggestion.id);
    setError(null);
    try {
      for (const noteId of suggestion.noteIds) {
        const payload: Parameters<typeof updateAiNoteCall>[0] = {
          orgId,
          noteId,
        };
        if (suggestion.action === 'set_category') {
          payload.category = suggestion.payload.category ?? null;
        } else if (suggestion.action === 'set_status') {
          payload.status = suggestion.payload.status ?? 'open';
        } else if (suggestion.action === 'set_priority') {
          payload.priority = suggestion.payload.priority ?? null;
        } else if (suggestion.action === 'link_entity') {
          payload.relatedEntityLabel =
            suggestion.payload.relatedEntityLabel ?? null;
          payload.relatedEntityType = suggestion.payload.relatedEntityLabel
            ? 'extinguisher'
            : null;
        } else if (suggestion.action === 'resolve') {
          payload.status = 'resolved';
        }
        await updateAiNoteCall(payload);
      }
      setSuggestions((current) =>
        current.filter((item) => item.id !== suggestion.id),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to apply suggestion',
      );
    } finally {
      setApplyingSuggestionId(null);
    }
  }

  const modalOpen = createOpen || !!selectedNote;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Floor-walk observations for your organization. Tell the AI to take a
            note, or add one manually here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              openAssistant('Take a note that ')
            }
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            <Sparkles className="h-4 w-4" />
            Ask AI to take a note
          </button>
          {canManageNotes && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              New note
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            AI organization suggestions
          </div>
          <button
            type="button"
            onClick={() => void loadSuggestions()}
            disabled={loadingSuggestions}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loadingSuggestions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Analyze notes
          </button>
        </div>
        {suggestions.length === 0 ? (
          <p className="text-sm text-gray-500">
            Run analysis to get recommendations for categorizing, grouping, and
            closing notes.
          </p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {suggestion.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {suggestion.description}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Affects {suggestion.noteIds.length} note(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void applySuggestion(suggestion)}
                    disabled={applyingSuggestionId === suggestion.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {applyingSuggestionId === suggestion.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedSuggestions((current) => [
                        ...current,
                        suggestion.id,
                      ]);
                      setSuggestions((current) =>
                        current.filter((item) => item.id !== suggestion.id),
                      );
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as AiNoteStatus | '')
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.entries(NOTE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as NoteCategory | '')
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {NOTE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {NOTE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as NotePriority | '')
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All priorities</option>
          {NOTE_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {NOTE_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
        <select
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All authors</option>
          {authors.map(([uid, label]) => (
            <option key={uid} value={uid}>
              {label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={hideResolved}
            onChange={(e) => setHideResolved(e.target.checked)}
          />
          Hide resolved
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <NotebookPen className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No notes yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Click the AI sparkle button and say:{' '}
            <span className="font-medium">
              Take a note that the east wing FE-042 tag is missing
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <div
              key={note.id}
              className={`rounded-lg border bg-white p-4 shadow-sm ${
                note.pinned ? 'border-amber-300' : 'border-gray-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openEditModal(note)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {note.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </span>
                    )}
                    {note.category && (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          NOTE_CATEGORY_COLORS[note.category]
                        }`}
                      >
                        {NOTE_CATEGORY_LABELS[note.category]}
                      </span>
                    )}
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {NOTE_STATUS_LABELS[note.status]}
                    </span>
                    {note.priority && note.priority !== 'normal' && (
                      <span className="text-xs font-medium text-red-600">
                        {NOTE_PRIORITY_LABELS[note.priority]} priority
                      </span>
                    )}
                  </div>
                  {note.title && (
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {note.title}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-700 line-clamp-3">
                    {note.content}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{note.createdByEmail ?? 'Unknown author'}</span>
                    <span>•</span>
                    <span>{formatTimestamp(note.updatedAt)}</span>
                    {note.relatedEntityLabel && (
                      <>
                        <span>•</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          {note.relatedEntityLabel}
                        </span>
                      </>
                    )}
                  </div>
                  {note.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>

                {canManageNotes && (
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void handleTogglePin(note)}
                      disabled={busyNoteId === note.id}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                      title={note.pinned ? 'Unpin note' : 'Pin note'}
                    >
                      {note.pinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </button>
                    <select
                      aria-label={`Status for note ${note.id}`}
                      value={note.status}
                      disabled={busyNoteId === note.id}
                      onChange={(e) =>
                        void handleQuickStatus(
                          note,
                          e.target.value as AiNoteStatus,
                        )
                      }
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    >
                      {Object.entries(NOTE_STATUS_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedNote ? 'Edit note' : 'New note'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Title (optional)
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, title: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Note
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      content: e.target.value,
                    }))
                  }
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        category: e.target.value as NoteCategory | '',
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Uncategorized</option>
                    {NOTE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {NOTE_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        priority: e.target.value as NotePriority | '',
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {NOTE_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {NOTE_PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedNote && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        status: e.target.value as AiNoteStatus,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {Object.entries(NOTE_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Tags (comma-separated)
                </label>
                <input
                  value={form.tags}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, tags: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Linked asset label
                </label>
                <input
                  value={form.relatedEntityLabel}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      relatedEntityLabel: e.target.value,
                    }))
                  }
                  placeholder="FE-042"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      pinned: e.target.checked,
                    }))
                  }
                />
                Pin this note
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  void (selectedNote ? handleSaveEdit() : handleSaveCreate())
                }
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {selectedNote ? 'Save changes' : 'Create note'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-500">
        Tip: use the AI assistant anywhere in the app and say{' '}
        <button
          type="button"
          onClick={() => openAssistant('Take a note that ')}
          className="font-medium text-red-600 hover:underline"
        >
          Take a note that ...
        </button>{' '}
        to capture observations while walking the floor. View all saved notes on{' '}
        <Link to="/dashboard/notes" className="font-medium text-red-600 hover:underline">
          this page
        </Link>
        .
      </p>
    </div>
  );
}
