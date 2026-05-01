/**
 * AI service for Extinguisher Tracker 3.
 * Uses Vertex AI (Gemini) via Firebase for compliance assistance,
 * inventory insights, and NFPA 10 guidance.
 *
 * Author: built_by_Beck
 */

import { geminiModel } from '../lib/firebase.ts';
import type { Extinguisher } from './extinguisherService.ts';
import type { Inspection } from './inspectionService.ts';
import type { SectionNotesMap } from './workspaceService.ts';
import { APP_KNOWLEDGE_BASE } from '../lib/aiKnowledgeBase.ts';
import { parseAiMemoryIntent } from './aiQueryIntentService.ts';
import { queryAiMemoryCall } from './aiQueryService.ts';
import type {
  AiMemoryExpiringExtinguisher,
  AiMemoryInspectionStatusMatch,
  AiMemoryNoteResult,
  AiMemoryQueryResponse,
  AiMemoryReplacementEvent,
} from '../types/aiQuery.ts';

const SYSTEM_PROMPT = `You are the Extinguisher Tracker 3 AI Assistant, built by Beck-Publishing.
You are an expert in NFPA 10 (Standard for Portable Fire Extinguishers) compliance,
fire extinguisher inspection, maintenance, and lifecycle management.

Your role:
- Answer questions about NFPA 10 compliance requirements
- Analyze extinguisher inventory data and flag issues
- Suggest maintenance actions and inspection priorities
- Explain compliance statuses and what they mean
- Help users understand inspection schedules (monthly, annual, 6-year, hydrostatic)
- Provide guidance on extinguisher categories, types, and placement
- Help users navigate and use the Extinguisher Tracker app itself (using the App Knowledge Base below).

Rules:
- Be concise and practical — users are busy inspectors and facility managers
- When analyzing data, reference specific extinguisher asset IDs
- Always cite NFPA 10 when relevant
- If you don't know something, say so — don't guess on safety-critical info
- Never suggest skipping required inspections or maintenance
- Format responses with markdown for readability

${APP_KNOWLEDGE_BASE}`;

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Send a message to the AI assistant with optional inventory context.
 */
export async function askAssistant(
  messages: AiMessage[],
  context?: {
    orgId?: string;
    orgName?: string;
    extinguishers?: Extinguisher[];
    complianceSummary?: Record<string, number>;
    activeWorkspaceId?: string | null;
    activeWorkspaceLabel?: string | null;
    inspections?: Inspection[];
    sectionNotes?: SectionNotesMap;
  },
): Promise<string> {
  const lastMessage = messages[messages.length - 1];
  const intent = parseAiMemoryIntent(lastMessage.content);
  if (context?.orgId && intent) {
    try {
      const result = await queryAiMemoryCall({ orgId: context.orgId, intent });
      return formatDeterministicMemoryResponse(result);
    } catch (err) {
      // Continue to conversational fallback on deterministic query failures.
      console.warn('Deterministic memory query failed. Falling back to Gemini.', err);
    }
  }

  // Build context block from org data
  let contextBlock = '';
  if (context) {
    const parts: string[] = [];
    if (context.orgName) {
      parts.push(`Organization: ${context.orgName}`);
    }
    if (context.complianceSummary) {
      parts.push(`Compliance Summary: ${JSON.stringify(context.complianceSummary)}`);
    }
    if (context.activeWorkspaceId || context.activeWorkspaceLabel) {
      parts.push(
        `Active Workspace: ${context.activeWorkspaceLabel ?? 'unknown'} (${context.activeWorkspaceId ?? 'no-id'})`,
      );
    }
    if (context.extinguishers && context.extinguishers.length > 0) {
      // Send a summary, not all fields — keep token count reasonable
      const summary = context.extinguishers.slice(0, 50).map((e) => ({
        assetId: e.assetId,
        serial: e.serial,
        category: e.category,
        extinguisherType: e.extinguisherType,
        section: e.section,
        complianceStatus: e.complianceStatus,
        lifecycleStatus: e.lifecycleStatus,
        manufactureYear: e.manufactureYear,
        expirationYear: e.expirationYear,
        isExpired: e.isExpired,
        lastMonthlyInspection: e.lastMonthlyInspection,
        lastAnnualInspection: e.lastAnnualInspection,
        nextMonthlyInspection: e.nextMonthlyInspection,
        nextAnnualInspection: e.nextAnnualInspection,
        nextSixYearMaintenance: e.nextSixYearMaintenance,
        nextHydroTest: e.nextHydroTest,
        manufactureDate: e.manufactureDate,
      }));
      parts.push(`Inventory (${context.extinguishers.length} total, showing first ${summary.length}):\n${JSON.stringify(summary, null, 2)}`);
    }
    if (context.inspections && context.inspections.length > 0) {
      const inspectionSummary = context.inspections.slice(0, 300).map((i) => ({
        assetId: i.assetId,
        extinguisherId: i.extinguisherId,
        status: i.status,
        locationId: i.locationId,
        section: i.section,
        inspectedByEmail: i.inspectedByEmail,
        inspectedAt: i.inspectedAt ?? null,
        notes: i.notes ?? '',
      }));
      parts.push(
        `Inspection status context (${context.inspections.length} total in active workspace, showing first ${inspectionSummary.length}):\n${JSON.stringify(
          inspectionSummary,
          null,
          2,
        )}`,
      );
    }
    if (context.sectionNotes && Object.keys(context.sectionNotes).length > 0) {
      const notesSummary = Object.entries(context.sectionNotes).map(([section, value]) => ({
        section,
        notes: value.notes,
        saveForNextMonth: value.saveForNextMonth,
        lastUpdated: value.lastUpdated,
      }));
      parts.push(
        `Section notes context (${notesSummary.length} total):\n${JSON.stringify(notesSummary, null, 2)}`,
      );
    }
    if (parts.length > 0) {
      contextBlock = `\n\nCurrent organization data:\n${parts.join('\n\n')}`;
    }
  }

  // Build conversation for Gemini
  const fullPrompt = SYSTEM_PROMPT + contextBlock;

  // Convert message history to Gemini content format
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'user' as const : 'model' as const,
    parts: [{ text: m.content }],
  }));

  const chat = geminiModel.startChat({
    history: [
      { role: 'user', parts: [{ text: 'System context: ' + fullPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I\'m the Extinguisher Tracker 3 AI Assistant by Beck-Publishing. I\'m ready to help with NFPA 10 compliance, inspection guidance, and inventory analysis. How can I help?' }] },
      ...history,
    ],
  });

  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
}

function formatDeterministicMemoryResponse(result: AiMemoryQueryResponse): string {
  const filters = Object.entries(result.appliedFilters)
    .map(([k, v]) => `- ${k}: ${v === null ? 'none' : String(v)}`)
    .join('\n');

  if (result.intentType === 'list_notes_by_month') {
    return formatNotesResult(result.count, filters, result.notes ?? []);
  }
  if (result.intentType === 'list_expiring_by_year') {
    return formatExpiringResult(result.count, filters, result.expiringExtinguishers ?? []);
  }
  if (result.intentType === 'list_marked_expired') {
    return formatMarkedExpiredResult(result.count, filters, result.expiredExtinguishers ?? []);
  }
  if (result.intentType === 'list_expired_candidates') {
    return formatExpiredCandidatesResult(result.count, filters, result.expiredCandidateExtinguishers ?? []);
  }
  if (result.intentType === 'get_extinguisher_inspection_status') {
    return formatInspectionStatusResult(
      result.count,
      filters,
      result.inspectionStatusMatches ?? [],
    );
  }
  return formatReplacementResult(result.count, filters, result.replacementEvents ?? []);
}

function formatNotesResult(count: number, filters: string, notes: AiMemoryNoteResult[]): string {
  const items = notes.slice(0, 10).map((note) => {
    const created = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'unknown date';
    return `- ${created} | ${note.status} | ${note.content}`;
  });

  return [
    '### Notes query result',
    `Found **${count}** note(s).`,
    '',
    '**Applied filters**',
    filters,
    '',
    items.length > 0 ? '**Top matches**' : '**Top matches**\n- No notes matched this filter window.',
    ...items,
    '',
    '_If you meant a different month or only open/resolved notes, tell me and I will rerun it._',
  ].join('\n');
}

function formatExpiringResult(
  count: number,
  filters: string,
  extinguishers: AiMemoryExpiringExtinguisher[],
): string {
  const items = extinguishers.slice(0, 20).map((ext) => {
    const location = ext.section || ext.parentLocation || 'unassigned';
    return `- ${ext.assetId} (${ext.serial}) | ${location} | status: ${ext.lifecycleStatus ?? 'unknown'}`;
  });

  return [
    '### Expiration query result',
    `Found **${count}** extinguisher(s) matching the expiration filter.`,
    '',
    '**Applied filters**',
    filters,
    '',
    items.length > 0 ? '**Top matches**' : '**Top matches**\n- No extinguishers matched this year.',
    ...items,
    '',
    '_If you want this grouped by location or exported, ask and I can format it._',
  ].join('\n');
}

function formatMarkedExpiredResult(
  count: number,
  filters: string,
  extinguishers: AiMemoryExpiringExtinguisher[],
): string {
  const items = extinguishers.map((ext) => {
    const location = ext.section || ext.parentLocation || 'unassigned';
    const mfg = ext.manufactureYear != null ? ` | mfg: ${ext.manufactureYear}` : '';
    const exp = ext.expirationYear != null ? ` | exp: ${ext.expirationYear}` : '';
    return `- ${ext.assetId} (${ext.serial || 'no serial'}) | ${location}${mfg}${exp}`;
  });

  return [
    '### Marked expired extinguishers',
    `Found **${count}** extinguisher(s) marked expired.`,
    '',
    '**Applied filters**',
    filters,
    '',
    items.length > 0 ? '**Printable list**' : '**Printable list**\n- No extinguishers are marked expired.',
    ...items,
    '',
    '_This official replacement list only includes units where the expired checkbox has been saved. Possible candidates are separate; ask for possible expired candidates if you want that advisory list too._',
  ].join('\n');
}

function formatExpiredCandidatesResult(
  count: number,
  filters: string,
  extinguishers: AiMemoryExpiringExtinguisher[],
): string {
  const items = extinguishers.map((ext) => {
    const location = ext.section || ext.parentLocation || 'unassigned';
    return `- ${ext.assetId} (${ext.serial || 'no serial'}) | ${location} | mfg: ${ext.manufactureYear ?? 'unknown'}`;
  });

  return [
    '### Possible expired candidates',
    `Found **${count}** active extinguisher(s) manufactured 6+ years ago that are not marked expired.`,
    '',
    '**Applied filters**',
    filters,
    '',
    items.length > 0 ? '**Candidate list**' : '**Candidate list**\n- No possible candidates matched this rule.',
    ...items,
    '',
    '_This is not the official expired list. It is only a follow-up list to help catch units someone may have forgotten to mark expired._',
  ].join('\n');
}

function formatReplacementResult(
  count: number,
  filters: string,
  replacementEvents: AiMemoryReplacementEvent[],
): string {
  const items = replacementEvents.slice(0, 20).map((event) => {
    const date = event.performedAt ? new Date(event.performedAt).toLocaleDateString() : 'unknown date';
    const oldAsset = event.oldAssetId ?? 'unknown old asset';
    const newAsset = event.newAssetId ?? 'unknown new asset';
    return `- ${date} | ${oldAsset} -> ${newAsset}`;
  });

  return [
    '### Replacement query result',
    `Total replaced in window: **${count}**`,
    '',
    '**Applied filters**',
    filters,
    '',
    items.length > 0 ? '**Recent replacement events**' : '**Recent replacement events**\n- No replacements were logged in this window.',
    ...items,
    '',
    '_If you want only one building/section, ask with that location and month._',
  ].join('\n');
}

function formatInspectionStatusResult(
  count: number,
  filters: string,
  matches: AiMemoryInspectionStatusMatch[],
): string {
  const items = matches.slice(0, 20).map((row) => {
    const checked =
      row.status === 'pending' ? 'Not yet inspected' : `Checked (${row.status.toUpperCase()})`;
    const inspectedWhen = row.inspectedAt
      ? new Date(row.inspectedAt).toLocaleString()
      : 'not inspected yet';
    const noteSuffix = row.notes ? ` | note: ${row.notes}` : '';
    return `- ${row.assetId} | ${checked} | section: ${row.section || 'unassigned'} | ${inspectedWhen}${noteSuffix}`;
  });

  return [
    '### Extinguisher inspection status',
    `Found **${count}** matching inspection record(s).`,
    '',
    '**Applied filters**',
    filters,
    '',
    items.length > 0
      ? '**Matches**'
      : '**Matches**\n- No matching extinguisher inspection was found in the active workspace.',
    ...items,
  ].join('\n');
}

/**
 * Get a quick AI insight about the current compliance state.
 * Used for the dashboard insights card.
 */
export async function getComplianceInsight(
  complianceSummary: Record<string, number>,
  orgName: string,
): Promise<string> {
  const prompt = `Given this compliance summary for "${orgName}":
${JSON.stringify(complianceSummary, null, 2)}

Provide a brief 2-3 sentence insight about the organization's compliance health.
Focus on the most urgent items. Be direct and actionable. No markdown headers.`;

  const result = await geminiModel.generateContent(SYSTEM_PROMPT + '\n\n' + prompt);
  return result.response.text();
}
