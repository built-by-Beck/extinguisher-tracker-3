import { geminiModel } from '../lib/firebase.ts';
import type { AiNote } from '../types/aiNote.ts';
import type { NoteCategory } from '../types/aiNote.ts';
import { NOTE_CATEGORY_LABELS } from '../lib/aiNoteConstants.ts';

export interface NoteOrganizationSuggestion {
  id: string;
  title: string;
  description: string;
  noteIds: string[];
  action:
    | 'set_category'
    | 'set_status'
    | 'set_priority'
    | 'link_entity'
    | 'resolve';
  payload: {
    category?: NoteCategory | null;
    status?: 'open' | 'in_progress' | 'resolved';
    priority?: 'low' | 'normal' | 'high' | null;
    relatedEntityLabel?: string | null;
  };
}

function buildHeuristicSuggestions(notes: AiNote[]): NoteOrganizationSuggestion[] {
  const suggestions: NoteOrganizationSuggestion[] = [];
  const openNotes = notes.filter((note) => note.status !== 'resolved');

  const safetyNotes = openNotes.filter((note) => note.category === 'safety');
  if (safetyNotes.length > 0) {
    suggestions.push({
      id: 'safety-open',
      title: 'Prioritize safety notes',
      description: `${safetyNotes.length} open safety note(s) may need immediate attention.`,
      noteIds: safetyNotes.map((note) => note.id),
      action: 'set_priority',
      payload: { priority: 'high' },
    });
  }

  const uncategorized = openNotes.filter((note) => !note.category);
  if (uncategorized.length >= 3) {
    suggestions.push({
      id: 'uncategorized',
      title: 'Categorize general notes',
      description: `${uncategorized.length} open notes have no category. Consider grouping them as maintenance or follow-up items.`,
      noteIds: uncategorized.slice(0, 10).map((note) => note.id),
      action: 'set_category',
      payload: { category: 'maintenance' },
    });
  }

  const byAsset = new Map<string, AiNote[]>();
  for (const note of openNotes) {
    const label =
      note.relatedEntityLabel ??
      note.content.match(/\b([A-Z]{1,5}-\d{2,})\b/i)?.[1]?.toUpperCase();
    if (!label) continue;
    const bucket = byAsset.get(label) ?? [];
    bucket.push(note);
    byAsset.set(label, bucket);
  }

  for (const [label, grouped] of byAsset.entries()) {
    if (grouped.length < 2) continue;
    suggestions.push({
      id: `asset-${label}`,
      title: `Group notes for ${label}`,
      description: `${grouped.length} open notes mention ${label}. Link them together and resolve duplicates when handled.`,
      noteIds: grouped.map((note) => note.id),
      action: 'link_entity',
      payload: { relatedEntityLabel: label },
    });
  }

  const staleResolvedCandidates = openNotes.filter((note) => {
    const lower = note.content.toLowerCase();
    return /\b(done|completed|fixed|resolved|replaced)\b/.test(lower);
  });
  if (staleResolvedCandidates.length > 0) {
    suggestions.push({
      id: 'maybe-resolved',
      title: 'Close likely-resolved notes',
      description: `${staleResolvedCandidates.length} open note(s) sound like they may already be handled.`,
      noteIds: staleResolvedCandidates.map((note) => note.id),
      action: 'resolve',
      payload: { status: 'resolved' },
    });
  }

  return suggestions.slice(0, 5);
}

export async function suggestNoteOrganization(
  notes: AiNote[],
): Promise<NoteOrganizationSuggestion[]> {
  const openNotes = notes
    .filter((note) => note.status !== 'resolved')
    .slice(0, 20);

  if (openNotes.length === 0) {
    return [];
  }

  const heuristic = buildHeuristicSuggestions(openNotes);
  if (openNotes.length < 4) {
    return heuristic;
  }

  try {
    const summary = openNotes
      .map(
        (note, index) =>
          `${index + 1}. [${note.id}] ${note.category ?? 'uncategorized'} / ${note.status} / ${note.priority ?? 'normal'} — ${note.content.slice(0, 120)}`,
      )
      .join('\n');

    const prompt = `You are helping organize fire extinguisher floor-walk notes.
Review these open notes and return up to 3 practical organization suggestions as JSON array.
Each item must use this shape:
{"title":"short title","description":"one sentence","noteIds":["id1"],"action":"set_category|set_status|set_priority|link_entity|resolve","payload":{"category":"maintenance","status":"resolved","priority":"high","relatedEntityLabel":"FE-042"}}

Valid categories: ${Object.keys(NOTE_CATEGORY_LABELS).join(', ')}
Only reference note IDs from the list.
Notes:
${summary}`;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return heuristic;
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      title?: string;
      description?: string;
      noteIds?: string[];
      action?: NoteOrganizationSuggestion['action'];
      payload?: NoteOrganizationSuggestion['payload'];
    }>;

    const validIds = new Set(openNotes.map((note) => note.id));
    const aiSuggestions = parsed
      .filter(
        (item) =>
          item.title &&
          item.description &&
          Array.isArray(item.noteIds) &&
          item.noteIds.some((id) => validIds.has(id)),
      )
      .map((item, index) => ({
        id: `ai-${index}`,
        title: item.title!,
        description: item.description!,
        noteIds: item.noteIds!.filter((id) => validIds.has(id)),
        action: item.action ?? 'set_category',
        payload: item.payload ?? {},
      }));

    const merged = [...aiSuggestions, ...heuristic];
    const seen = new Set<string>();
    return merged.filter((item) => {
      const key = `${item.action}:${item.noteIds.join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  } catch {
    return heuristic;
  }
}
