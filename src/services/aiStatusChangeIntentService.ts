/**
 * Detects imperative user messages that should run updateExtinguisherStatus
 * (owner/admin only — enforced server-side).
 *
 * Author: built_by_Beck
 */

import type { ExtinguisherLifecycleStatusValue } from '../lib/extinguisherLifecycleStatus.ts';

export interface AiExtinguisherStatusChangeIntent {
  assetId?: string;
  extinguisherId?: string;
  newStatus: ExtinguisherLifecycleStatusValue;
}

function normalizeStatusToken(raw: string): ExtinguisherLifecycleStatusValue | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (s === 'active') return 'active';
  if (s === 'spare') return 'spare';
  if (s === 'replaced') return 'replaced';
  if (s === 'retired') return 'retired';
  if (s === 'out of service' || s === 'out_of_service') return 'out_of_service';
  return null;
}

/**
 * Returns a structured status-change intent when the message clearly requests
 * updating an extinguisher's lifecycle (not e.g. "what is the status of …").
 */
export function parseAiExtinguisherStatusChangeIntent(
  message: string,
): AiExtinguisherStatusChangeIntent | null {
  const lower = message.toLowerCase();
  if (!/\b(set|mark|change|update|correct|make)\b/.test(lower)) {
    return null;
  }

  const statusTokenMatch = message.match(
    /\b(?:to|as)\s+(active|spare|replaced|retired|out\s+of\s+service)\b/i,
  );
  if (!statusTokenMatch?.[1]) return null;
  const newStatus = normalizeStatusToken(statusTokenMatch[1]);
  if (!newStatus) return null;

  const extIdMatch = message.match(
    /\bextinguisher\s+id\s*[:#]?\s*([A-Za-z0-9_-]{6,})\b/i,
  );
  if (extIdMatch?.[1]) {
    return { extinguisherId: extIdMatch[1].trim(), newStatus };
  }

  const assetMatch =
    message.match(
      /\b(?:set|mark|change|update|correct|make)\s+(?:the\s+)?(?:extinguisher\s+)?(?:asset|unit)\s*(?:#|number|id)?\s*[:#]?\s*([A-Za-z0-9_.-]+)\s+(?:to|as)\s+/i,
    ) ??
    message.match(
      /\bstatus\s+(?:of|for)\s+(?:asset|unit)\s*(?:#|number|id)?\s*[:#]?\s*([A-Za-z0-9_.-]+)\s+(?:to|as)\s+/i,
    ) ??
    message.match(/\basset\s*[:#]\s*([A-Za-z0-9_.-]+)\s+(?:to|as)\s+/i);

  if (assetMatch?.[1]) {
    return { assetId: assetMatch[1].trim(), newStatus };
  }

  return null;
}
