import type {
  AiNoteClassification,
  NoteCategory,
  NotePriority,
} from '../types/aiNote.ts';

const CATEGORY_KEYWORDS: Array<{ category: NoteCategory; patterns: RegExp[] }> = [
  {
    category: 'safety',
    patterns: [
      /\b(safety|hazard|danger|blocked exit|emergency|immediate)\b/i,
    ],
  },
  {
    category: 'compliance',
    patterns: [/\b(nfpa|compliance|code|violation|ahj|inspection due)\b/i],
  },
  {
    category: 'maintenance',
    patterns: [
      /\b(maintenance|service|repair|hydro|recharge|pressure|gauge)\b/i,
    ],
  },
  {
    category: 'tagging',
    patterns: [/\b(tag|label|sticker|missing tag|damaged tag)\b/i],
  },
  {
    category: 'replacement',
    patterns: [/\b(replace|replacement|retire|expired|end of life)\b/i],
  },
  {
    category: 'location',
    patterns: [
      /\b(access|blocked|mount|signage|floor|wing|hallway|room|location)\b/i,
    ],
  },
  {
    category: 'follow_up',
    patterns: [/\b(call|vendor|follow up|follow-up|schedule|contact)\b/i],
  },
];

const HIGH_PRIORITY_PATTERNS = [
  /\b(immediate|urgent|asap|safety|hazard|blocked exit|danger)\b/i,
];

const LOW_PRIORITY_PATTERNS = [/\b(low priority|minor|cosmetic|when possible)\b/i];

const ASSET_ID_PATTERN =
  /\b(?:asset(?:\s*id)?|extinguisher|unit)\s*[:#-]?\s*([a-z0-9_-]{2,})\b/i;
const SHORT_ASSET_PATTERN = /\b([a-z]{1,5}-\d{2,})\b/i;

export function classifyNoteContent(content: string): AiNoteClassification {
  const normalized = content.trim();
  let category: NoteCategory | null = null;

  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      category = entry.category;
      break;
    }
  }

  let priority: NotePriority | null = 'normal';
  if (HIGH_PRIORITY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    priority = 'high';
  } else if (
    LOW_PRIORITY_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    priority = 'low';
  }

  const assetMatch =
    normalized.match(SHORT_ASSET_PATTERN) ??
    normalized.match(ASSET_ID_PATTERN);
  const relatedEntityLabel = assetMatch?.[1]?.toUpperCase() ?? null;

  const tags: string[] = [];
  if (relatedEntityLabel) {
    tags.push(relatedEntityLabel);
  }
  if (category) {
    tags.push(category);
  }

  return {
    category,
    priority,
    relatedEntityLabel,
    tags: [...new Set(tags)].slice(0, 5),
  };
}

export function formatClassificationSummary(
  classification: AiNoteClassification,
): string {
  const parts: string[] = [];
  if (classification.category) {
    parts.push(classification.category.replace('_', ' '));
  }
  if (classification.priority && classification.priority !== 'normal') {
    parts.push(`${classification.priority} priority`);
  }
  if (classification.relatedEntityLabel) {
    parts.push(`linked to ${classification.relatedEntityLabel}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'open';
}
