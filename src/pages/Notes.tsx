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
  Mic,
  MicOff,
  Download,
  ClipboardCheck,
  Camera,
  Merge,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useOffline } from '../hooks/useOffline.ts';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace.ts';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition.ts';
import { useAiAssistant } from '../contexts/AiAssistantContext.tsx';
import {
  convertNoteToInspectionCall,
  createAiNoteCall,
  createAiNoteOfflineAware,
  mergeAiNotesCall,
  subscribeToAiNotes,
  updateAiNoteCall,
  updateAiNoteOfflineAware,
} from '../services/aiNotesService.ts';
import {
  fileToDataUrl,
  uploadNotePhoto,
} from '../services/notePhotoService.ts';
import {
  suggestNoteOrganization,
  type NoteOrganizationSuggestion,
} from '../services/aiNoteOrganizer.ts';
import { downloadNotesCsv } from '../lib/exportNotesCsv.ts';
import { NOTE_TEMPLATES } from '../lib/noteTemplates.ts';
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
  const { org, hasRole } = useOrg();
  const { isOnline } = useOffline();
  const activeWorkspace = useActiveWorkspace(userProfile?.activeOrgId ?? '');
  const { openAssistant } = useAiAssistant();
  const {
    supported: voiceSupported,
    listening,
    error: voiceError,
    startListening,
    stopListening,
  } = useSpeechRecognition();
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [convertingNoteId, setConvertingNoteId] = useState<string | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);

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

  function openCreateModal(templateId?: string) {
    const template = NOTE_TEMPLATES.find((item) => item.id === templateId);
    setForm(
      template
        ? {
            ...EMPTY_FORM,
            content: template.content,
            category: template.category,
          }
        : EMPTY_FORM,
    );
    setPhotoFile(null);
    setPhotoPreview(null);
    setCreateOpen(true);
    setError(null);
    setSavedLocally(false);
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
    setPhotoFile(null);
    setPhotoPreview(note.photoUrl ?? null);
    setError(null);
    setSavedLocally(false);
  }

  function closeModal() {
    setCreateOpen(false);
    setSelectedNote(null);
    setForm(EMPTY_FORM);
    setPhotoFile(null);
    setPhotoPreview(null);
    setError(null);
    setSavedLocally(false);
    stopListening();
  }

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSaveCreate() {
    if (!orgId || !form.content.trim()) {
      setError('Note content is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSavedLocally(false);
    try {
      const baseInput = {
        orgId,
        title: form.title.trim() || undefined,
        content: form.content.trim(),
        source: 'manual' as const,
        category: form.category || null,
        priority: form.priority || null,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        relatedEntityLabel: form.relatedEntityLabel.trim() || null,
        relatedEntityType: form.relatedEntityLabel.trim()
          ? ('extinguisher' as const)
          : null,
        pinned: form.pinned,
        workspaceId: activeWorkspace?.id ?? null,
        workspaceLabel: activeWorkspace?.label ?? null,
      };

      if (photoFile && isOnline) {
        const { noteId } = await createAiNoteCall(baseInput);
        const { photoUrl, photoPath } = await uploadNotePhoto(
          orgId,
          noteId,
          photoFile,
        );
        await updateAiNoteCall({ orgId, noteId, photoUrl, photoPath });
      } else {
        const photoDataUrl = photoFile ? await fileToDataUrl(photoFile) : null;
        const result = await createAiNoteOfflineAware(
          baseInput,
          isOnline,
          photoDataUrl,
          photoFile?.type ?? null,
        );
        if (!result.synced) {
          setSavedLocally(true);
        } else if (photoFile && result.noteId) {
          const { photoUrl, photoPath } = await uploadNotePhoto(
            orgId,
            result.noteId,
            photoFile,
          );
          await updateAiNoteCall({ orgId, noteId: result.noteId, photoUrl, photoPath });
        }
      }
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
    setSavedLocally(false);
    try {
      const payload = {
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
          ? ('extinguisher' as const)
          : null,
        pinned: form.pinned,
        workspaceId: activeWorkspace?.id ?? selectedNote.workspaceId,
        workspaceLabel: activeWorkspace?.label ?? selectedNote.workspaceLabel,
      };

      if (photoFile && isOnline) {
        const { photoUrl, photoPath } = await uploadNotePhoto(
          orgId,
          selectedNote.id,
          photoFile,
        );
        await updateAiNoteCall({ ...payload, photoUrl, photoPath });
      } else {
        const result = await updateAiNoteOfflineAware(payload, isOnline);
        if (!result.synced) setSavedLocally(true);
      }
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

    if (suggestion.action === 'merge') {
      const targetNoteId =
        suggestion.payload.targetNoteId ?? suggestion.noteIds[0];
      const sourceNoteIds = suggestion.noteIds.filter(
        (id) => id !== targetNoteId,
      );
      if (!targetNoteId || sourceNoteIds.length === 0) return;
      setApplyingSuggestionId(suggestion.id);
      setError(null);
      try {
        await mergeAiNotesCall({ orgId, targetNoteId, sourceNoteIds });
        setSuggestions((current) =>
          current.filter((item) => item.id !== suggestion.id),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to merge notes');
      } finally {
        setApplyingSuggestionId(null);
      }
      return;
    }

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

  async function handleConvertToInspection(note: AiNote) {
    if (!orgId || !canManageNotes) return;
    setConvertingNoteId(note.id);
    setError(null);
    try {
      const result = await convertNoteToInspectionCall({
        orgId,
        noteId: note.id,
        workspaceId: note.workspaceId ?? activeWorkspace?.id,
      });
      setError(null);
      window.alert(
        `Converted note to a failed inspection task for ${result.assetId ?? 'the linked asset'}. Open the workspace inspection to review it.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to convert note to inspection',
      );
    } finally {
      setConvertingNoteId(null);
    }
  }

  function handleVoiceInput() {
    if (listening) {
      stopListening();
      return;
    }
    startListening((text, isFinal) => {
      setForm((current) => ({
        ...current,
        content: isFinal
          ? `${current.content}${current.content ? ' ' : ''}${text}`.trim()
          : `${current.content}${current.content ? ' ' : ''}${text}`.trim(),
      }));
      if (isFinal) stopListening();
    });
  }

  const modalOpen = createOpen || !!selectedNote;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Floor-walk observations for your organization. Tell the AI to take a
            note, use voice input, or add one manually here.
          </p>
          {activeWorkspace && (
            <p className="mt-1 text-xs text-gray-500">
              New notes will tag workspace:{' '}
              <span className="font-medium">{activeWorkspace.label}</span>
            </p>
          )}
          {!isOnline && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Offline — new notes will sync when you reconnect.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadNotesCsv(filtered, org?.name ?? 'organization')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
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
              onClick={() => openCreateModal()}
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
      {voiceError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {voiceError}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {NOTE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => openCreateModal(template.id)}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:border-red-300 hover:text-red-700"
          >
            {template.label}
          </button>
        ))}
      </div>

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
                    ) : suggestion.action === 'merge' ? (
                      <Merge className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {suggestion.action === 'merge' ? 'Merge' : 'Apply'}
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
                  {note.photoUrl && (
                    <img
                      src={note.photoUrl}
                      alt="Note attachment"
                      className="mt-2 max-h-32 rounded-lg border border-gray-200 object-cover"
                    />
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{note.createdByEmail ?? 'Unknown author'}</span>
                    <span>•</span>
                    <span>{formatTimestamp(note.updatedAt)}</span>
                    {note.workspaceLabel && (
                      <>
                        <span>•</span>
                        <span>{note.workspaceLabel}</span>
                      </>
                    )}
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
                      onClick={() => void handleConvertToInspection(note)}
                      disabled={convertingNoteId === note.id}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      title="Convert to failed inspection task"
                    >
                      {convertingNoteId === note.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ClipboardCheck className="h-3 w-3" />
                      )}
                      Inspect
                    </button>
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
                <div className="mt-2 flex flex-wrap gap-2">
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={handleVoiceInput}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                        listening
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {listening ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                      {listening ? 'Stop voice' : 'Voice input'}
                    </button>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    <Camera className="h-3.5 w-3.5" />
                    Attach photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => void handlePhotoSelect(e)}
                    />
                  </label>
                </div>
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Selected note photo"
                    className="mt-2 max-h-40 rounded-lg border border-gray-200 object-cover"
                  />
                )}
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

            {savedLocally && (
              <p className="mt-4 text-sm text-amber-700">
                Saved locally. This note will sync when you are back online.
              </p>
            )}

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
