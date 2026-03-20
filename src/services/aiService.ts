/**
 * AI service for Extinguisher Tracker 3.
 * Uses Vertex AI (Gemini) via Firebase for compliance assistance,
 * inventory insights, and NFPA 10 guidance.
 *
 * Author: built_by_Beck
 */

import { geminiModel } from '../lib/firebase.ts';
import type { Extinguisher } from './extinguisherService.ts';

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

Rules:
- Be concise and practical — users are busy inspectors and facility managers
- When analyzing data, reference specific extinguisher asset IDs
- Always cite NFPA 10 when relevant
- If you don't know something, say so — don't guess on safety-critical info
- Never suggest skipping required inspections or maintenance
- Format responses with markdown for readability`;

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
      { role: 'model', parts: [{ text: 'Understood. I\'m the Extinguisher Tracker 3 AI Assistant by Beck-Publishing. I\'m ready to help with NFPA 10 compliance, inspection guidance, and inventory analysis. How can I help?' }] },
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
