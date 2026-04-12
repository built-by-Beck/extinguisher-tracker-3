/**
 * AI service for Extinguisher Tracker 3.
 * Uses Vertex AI (Gemini) via Firebase for compliance assistance,
 * inventory insights, and NFPA 10 guidance.
 *
 * Author: built_by_Beck
 */

import { geminiModel } from '../lib/firebase.ts';
import type { Extinguisher } from './extinguisherService.ts';
import { APP_KNOWLEDGE_BASE } from '../lib/aiKnowledgeBase.ts';

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
- If you don't know something SAFETY-CRITICAL, say so — don't guess on NFPA rules
- Never suggest skipping required inspections or maintenance
- Format responses with markdown for readability
- NEVER refuse a question about how to use the Extinguisher Tracker app. If the answer
  isn't obvious from the App Knowledge Base, give the user your best reasonable answer
  based on typical SaaS UI patterns and point them to the most likely page in the sidebar.
- When the user asks "how do I..." or "where is...", use their "Current page" from the
  runtime context to give directions relative to where they already are.
- When the user asks why a feature is missing, greyed out, or locked, check their plan
  and role in the runtime context against the Plan/Role tables in the knowledge base
  before answering.

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
    orgName?: string;
    plan?: string | null;
    userRole?: string | null;
    userName?: string | null;
    currentPage?: { path: string; label?: string } | null;
    pendingSyncCount?: number;
    extinguishers?: Extinguisher[];
    complianceSummary?: Record<string, number>;
  },
): Promise<string> {
  // Build context block from org data
  let contextBlock = '';
  if (context) {
    const parts: string[] = [];
    if (context.orgName) {
      parts.push(`Organization: ${context.orgName}`);
    }
    if (context.plan) {
      parts.push(`Plan: ${context.plan}`);
    }
    if (context.userName || context.userRole) {
      const bits: string[] = [];
      if (context.userName) bits.push(`name=${context.userName}`);
      if (context.userRole) bits.push(`role=${context.userRole}`);
      parts.push(`User: ${bits.join(', ')}`);
    }
    if (context.currentPage) {
      const label = context.currentPage.label ? ` (${context.currentPage.label})` : '';
      parts.push(`Current page: ${context.currentPage.path}${label}`);
    }
    if (typeof context.pendingSyncCount === 'number') {
      parts.push(`Pending offline writes in Sync Queue: ${context.pendingSyncCount}`);
    }
    if (context.complianceSummary) {
      parts.push(`Compliance Summary: ${JSON.stringify(context.complianceSummary)}`);
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

  const lastMessage = messages[messages.length - 1];

  const chat = geminiModel.startChat({
    history: [
      { role: 'user', parts: [{ text: 'System context: ' + fullPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I\'m the Extinguisher Tracker 3 AI Assistant by Beck-Publishing. I can help with NFPA 10 compliance, inspection guidance, inventory analysis, AND anything about how to use the Extinguisher Tracker app itself — navigating pages, finding features, troubleshooting, plan/role questions, and step-by-step how-tos. I will use the App Knowledge Base and the user\'s current-page context to give specific answers, and I will never refuse a program-related question. How can I help?' }] },
      ...history,
    ],
  });

  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
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
