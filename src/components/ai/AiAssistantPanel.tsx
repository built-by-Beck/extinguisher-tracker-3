/**
 * AI Assistant collapsible chat panel.
 * Floating button + slide-out panel for asking the AI about compliance,
 * inventory, and NFPA 10 guidance.
 *
 * Author: built_by_Beck
 */

import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  Trash2,
  NotebookPen,
  Camera,
  FolderOpen,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  askAssistant,
  type AiImageAttachment,
  type AiMessage,
} from '../../services/aiService.ts';
import {
  createAiNoteCall,
  subscribeToAiNotes,
  updateAiNoteStatusCall,
} from '../../services/aiNotesService.ts';
import { useOrg } from '../../hooks/useOrg.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { db } from '../../lib/firebase.ts';
import type { Extinguisher } from '../../services/extinguisherService.ts';
import type { AiNote, AiNoteStatus } from '../../types/aiNote.ts';
import type { NfpaEdition } from '../../types/organization.ts';
import type { Workspace } from '../../services/workspaceService.ts';
import {
  subscribeToInspections,
  type Inspection,
} from '../../services/inspectionService.ts';
import { subscribeToSectionNotes } from '../../services/sectionNotesService.ts';
import type { SectionNotesMap } from '../../services/workspaceService.ts';

interface AiAssistantPanelProps {
  extinguishers?: Extinguisher[];
  complianceSummary?: Record<string, number>;
}

interface SelectedAiImage {
  attachment: AiImageAttachment;
  previewUrl: string;
}

const AI_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const AI_IMAGE_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const AI_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

function formatNfpaReference(
  edition?: NfpaEdition,
  customLabel?: string,
): string {
  if (edition === 'other') {
    return customLabel?.trim() || 'our AHJ-specific NFPA reference';
  }
  return `NFPA 10 (${edition ?? '2022'})`;
}

function buildSuggestedPrompts(nfpaReference: string): string[] {
  return [
    `What does ${nfpaReference} require for monthly inspections?`,
    `Compare ${nfpaReference} to our local AHJ notes for annual requirements.`,
    'Show all notes from this month',
    'Show extinguishers expiring next year',
    'Show marked expired extinguishers',
    'Show possible expired candidates',
    'How many extinguishers did we replace last month?',
    'What inspections are overdue?',
    'Summarize my compliance status and mention sections taking the longest time',
  ];
}

const NOTE_INTENT_PATTERN = /\b(take|save|create|add|make)\s+(?:a\s+)?note\b/i;

function extractNoteContent(message: string): string | null {
  if (!NOTE_INTENT_PATTERN.test(message)) {
    return null;
  }

  const content = message
    .replace(/^.*?\bnote\b(?:\s+that)?[\s:,-]*/i, '')
    .trim();

  return content || null;
}

function buildComplianceSummary(
  extinguishers: Extinguisher[],
): Record<string, number> {
  const activeExts = extinguishers.filter(
    (e) => e.lifecycleStatus === 'active',
  );
  const summary: Record<string, number> = {
    total: activeExts.length,
    compliant: 0,
    monthly_due: 0,
    annual_due: 0,
    six_year_due: 0,
    hydro_due: 0,
    overdue: 0,
    missing_data: 0,
  };

  for (const ext of activeExts) {
    const status = ext.complianceStatus ?? 'missing_data';
    if (status in summary) {
      summary[status]++;
    }
  }

  return summary;
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () =>
      reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export function AiAssistantPanel({
  extinguishers,
  complianceSummary,
}: AiAssistantPanelProps) {
  const { org, hasRole } = useOrg();
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgExtinguishers, setOrgExtinguishers] = useState<Extinguisher[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(
    null,
  );
  const [activeWorkspaceInspections, setActiveWorkspaceInspections] = useState<
    Inspection[]
  >([]);
  const [sectionNotes, setSectionNotes] = useState<SectionNotesMap>({});
  const [notes, setNotes] = useState<AiNote[]>([]);
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedAiImage | null>(
    null,
  );
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // When mounted globally from layout, load org inventory context automatically.
  useEffect(() => {
    if (extinguishers || !orgId) return;

    const q = query(
      collection(db, 'org', orgId, 'extinguishers'),
      where('deletedAt', '==', null),
    );

    return onSnapshot(q, (snap) => {
      const exts = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Extinguisher,
      );
      setOrgExtinguishers(exts);
    });
  }, [extinguishers, orgId]);

  const resolvedExtinguishers = extinguishers ?? orgExtinguishers;
  const resolvedComplianceSummary =
    complianceSummary ?? buildComplianceSummary(resolvedExtinguishers);
  const canManageNotes = hasRole(['owner', 'admin', 'inspector']);
  const nfpaReference = formatNfpaReference(
    org?.settings?.nfpaEdition,
    org?.settings?.nfpaEditionLabel,
  );
  const suggestedPrompts = buildSuggestedPrompts(nfpaReference);

  useEffect(() => {
    if (!orgId) {
      setNotes([]);
      return;
    }

    return subscribeToAiNotes(orgId, setNotes, 8);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      setActiveWorkspace(null);
      return;
    }
    const q = query(
      collection(db, 'org', orgId, 'workspaces'),
      where('status', '==', 'active'),
    );
    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setActiveWorkspace(null);
          return;
        }
        const latest = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Workspace)
          .sort((a, b) =>
            (b.monthYear ?? '').localeCompare(a.monthYear ?? ''),
          )[0];
        setActiveWorkspace(latest ?? null);
      },
      () => setActiveWorkspace(null),
    );
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !activeWorkspace?.id) {
      setActiveWorkspaceInspections([]);
      return;
    }
    return subscribeToInspections(
      orgId,
      activeWorkspace.id,
      setActiveWorkspaceInspections,
    );
  }, [orgId, activeWorkspace?.id]);

  useEffect(() => {
    if (!orgId || !user?.uid) {
      setSectionNotes({});
      return;
    }
    return subscribeToSectionNotes(orgId, user.uid, setSectionNotes);
  }, [orgId, user?.uid]);

  async function saveNoteFromText(
    content: string,
    source: 'manual' | 'ai_suggested' = 'manual',
  ) {
    if (!orgId) return;
    try {
      await createAiNoteCall({ orgId, content, source });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save note';
      setError(msg);
    }
  }

  async function handleNoteStatusChange(noteId: string, status: AiNoteStatus) {
    if (!orgId || !canManageNotes) return;
    setNoteBusyId(noteId);
    try {
      await updateAiNoteStatusCall({ orgId, noteId, status });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update note status';
      setError(msg);
    } finally {
      setNoteBusyId(null);
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (selectedImage?.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl);
      }
    };
  }, [selectedImage?.previewUrl]);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !cameraStreamRef.current) {
      return;
    }

    videoRef.current.srcObject = cameraStreamRef.current;
    void videoRef.current.play().catch(() => {
      setError(
        'Camera started, but the preview could not play. Try using file upload instead.',
      );
    });
  }, [cameraOpen]);

  useEffect(() => {
    if (open) return;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCameraStarting(false);
  }, [open]);

  async function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    if (!AI_IMAGE_ALLOWED_TYPES.has(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > AI_IMAGE_MAX_BYTES) {
      setError(
        `Please choose an image smaller than ${formatBytes(AI_IMAGE_MAX_BYTES)}.`,
      );
      return;
    }

    try {
      await setTemporaryImage(file, file.name);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not read the selected image.';
      setError(msg);
    }
  }

  async function setTemporaryImage(file: Blob, name: string) {
    const data = await fileToBase64(file);
    const previewUrl = URL.createObjectURL(file);
    setSelectedImage((previous) => {
      if (previous?.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl);
      }
      return {
        previewUrl,
        attachment: {
          mimeType: file.type as AiImageAttachment['mimeType'],
          data,
          name,
          size: file.size,
        },
      };
    });
  }

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCameraStarting(false);
  }

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'This browser does not support live camera capture. Use file upload instead.',
      );
      return;
    }

    try {
      stopCamera();
      setCameraStarting(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or use file upload instead.'
          : 'Could not open the camera. Use file upload instead.';
      setError(msg);
    } finally {
      setCameraStarting(false);
    }
  }

  async function captureCameraPhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera preview is not ready yet. Try again in a moment.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Could not capture a photo from the camera.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.88);
    });
    if (!blob) {
      setError('Could not capture a photo from the camera.');
      return;
    }
    if (blob.size > AI_IMAGE_MAX_BYTES) {
      setError(
        `Captured photo is larger than ${formatBytes(AI_IMAGE_MAX_BYTES)}. Try file upload with a smaller image.`,
      );
      return;
    }

    await setTemporaryImage(blob, 'camera-photo.jpg');
    stopCamera();
  }

  function removeSelectedImage() {
    setSelectedImage((previous) => {
      if (previous?.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl);
      }
      return null;
    });
  }

  async function handleSend(text?: string) {
    const messageText = text ?? input.trim();
    const imageForMessage = selectedImage?.attachment;
    if (!messageText || loading) return;

    setError(null);
    setInput('');
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage.previewUrl);
      setSelectedImage(null);
    }

    const userMessage: AiMessage = {
      role: 'user',
      content: messageText,
      imageAttachments: imageForMessage ? [imageForMessage] : undefined,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const noteContent = extractNoteContent(messageText);
      if (noteContent && canManageNotes && !imageForMessage) {
        await saveNoteFromText(noteContent, 'ai_suggested');
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: `Saved note: "${noteContent}"\n\nI added it to your org notes with status **open**.`,
          },
        ]);
        return;
      }

      const response = await askAssistant(updatedMessages, {
        orgId,
        orgName: org?.name,
        extinguishers: resolvedExtinguishers,
        complianceSummary: resolvedComplianceSummary,
        activeWorkspaceId: activeWorkspace?.id ?? null,
        activeWorkspaceLabel: activeWorkspace?.label ?? null,
        inspections: activeWorkspaceInspections,
        sectionNotes,
        nfpaEdition: org?.settings?.nfpaEdition,
        nfpaEditionLabel: org?.settings?.nfpaEditionLabel,
        localComplianceNotes: org?.settings?.localComplianceNotes,
        canMutateInventory: hasRole(['owner', 'admin']),
      });
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: response },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([]);
    setError(null);
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-transform hover:scale-105"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 flex h-[32rem] w-full flex-col rounded-t-xl border border-gray-200 bg-white shadow-2xl sm:bottom-6 sm:right-6 sm:h-[36rem] sm:w-96 sm:rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  AI Assistant
                </h3>
                <p className="text-xs text-gray-500">
                  {nfpaReference} compliance help for Pro, Elite, and Enterprise
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="rounded bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700">
                {notes.length} notes
              </div>
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {notes.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <NotebookPen className="h-3.5 w-3.5" />
                  Recent notes
                </div>
                <div className="space-y-2">
                  {notes.slice(0, 3).map((note) => (
                    <div
                      key={note.id}
                      className="rounded border border-gray-200 bg-white p-2"
                    >
                      <p className="text-xs text-gray-700 line-clamp-2">
                        {note.content}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">
                          Status
                        </span>
                        <select
                          aria-label={`Status for note ${note.id}`}
                          value={note.status}
                          disabled={!canManageNotes || noteBusyId === note.id}
                          onChange={(e) =>
                            void handleNoteStatusChange(
                              note.id,
                              e.target.value as AiNoteStatus,
                            )
                          }
                          className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-700 disabled:opacity-60"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.length === 0 && !loading && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <Sparkles className="mx-auto mb-2 h-8 w-8 text-red-500/50" />
                  <p className="text-sm font-medium text-gray-700">
                    Hi{user?.displayName ? `, ${user.displayName}` : ''}!
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Ask me about NFPA 10 compliance, your inventory, or
                    inspection schedules.
                  </p>
                  <p className="mt-2 text-[11px] text-gray-400">
                    How to use AI: your org reference is {nfpaReference}. Ask
                    for overdue inspections, maintenance dates, section notes,
                    route pace guidance, marked expired units, or possible
                    expired candidates.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase">
                    Try asking
                  </p>
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void handleSend(prompt)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 hover:bg-gray-50 hover:border-red-300 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.imageAttachments?.map((image, imageIndex) => (
                    <div
                      key={`${image.name ?? 'image'}-${imageIndex}`}
                      className="mb-2"
                    >
                      <img
                        src={`data:${image.mimeType};base64,${image.data}`}
                        alt={
                          image.name
                            ? `Attached ${image.name}`
                            : 'Attached image'
                        }
                        className="max-h-32 rounded-md border border-white/30 object-cover"
                      />
                    </div>
                  ))}
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                  {msg.role === 'user' && canManageNotes && (
                    <button
                      type="button"
                      onClick={() => void saveNoteFromText(msg.content)}
                      className="mt-2 inline-flex items-center gap-1 rounded border border-white/30 px-2 py-0.5 text-[10px] text-white hover:bg-white/10"
                    >
                      <NotebookPen className="h-3 w-3" />
                      Save as note
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 px-4 py-3">
            {cameraOpen && (
              <div className="mb-2 rounded-lg border border-gray-200 bg-gray-900 p-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-40 w-full rounded-md bg-black object-cover"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-gray-300">
                    Camera preview is temporary. Capture a photo or cancel.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-100 hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void captureCameraPhoto()}
                      className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Capture
                    </button>
                  </div>
                </div>
              </div>
            )}
            {selectedImage && (
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
                <img
                  src={selectedImage.previewUrl}
                  alt="Selected AI question attachment"
                  className="h-14 w-14 rounded-md border border-gray-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-700">
                    {selectedImage.attachment.name ?? 'Attached image'}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Temporary photo, not saved.{' '}
                    {selectedImage.attachment.size
                      ? formatBytes(selectedImage.attachment.size)
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  disabled={loading}
                  className="rounded-md p-1 text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-50"
                  aria-label="Remove selected photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={imageInputRef}
                type="file"
                accept={AI_IMAGE_ACCEPT}
                onChange={(e) => void handleImageSelect(e)}
                disabled={loading}
                aria-label="Upload a temporary photo for the AI Assistant"
                title="Upload photo"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => void startCamera()}
                disabled={loading || cameraStarting}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Open camera"
                title="Open camera"
              >
                {cameraStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={loading || cameraStarting}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={
                  selectedImage
                    ? 'Change uploaded photo'
                    : 'Upload photo from files'
                }
                title={selectedImage ? 'Change uploaded photo' : 'Upload photo'}
              >
                <FolderOpen className="h-4 w-4" />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about compliance, inspections..."
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-gray-400">
              Pro+ AI can answer text or one temporary photo question.
              Reference: {nfpaReference}.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
