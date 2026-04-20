import type { AiMemoryQueryIntent, MonthWindow } from '../types/aiQuery.ts';

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function buildMonthWindow(year: number, month: number): MonthWindow {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return {
    year,
    month,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label,
  };
}

function parseMonthWindow(text: string, now = new Date()): MonthWindow | null {
  const lower = text.toLowerCase();
  const thisYear = now.getUTCFullYear();
  const thisMonth = now.getUTCMonth() + 1;

  if (lower.includes('this month')) {
    return buildMonthWindow(thisYear, thisMonth);
  }

  if (lower.includes('last month')) {
    const d = new Date(Date.UTC(thisYear, thisMonth - 2, 1));
    return buildMonthWindow(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }

  if (lower.includes('next month')) {
    const d = new Date(Date.UTC(thisYear, thisMonth, 1));
    return buildMonthWindow(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }

  const monthNameRegex = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\b(?:\\s+(\\d{4}))?`, 'i');
  const monthMatch = lower.match(monthNameRegex);
  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase();
    const month = MONTH_NAMES.indexOf(monthName) + 1;
    const year = monthMatch[2] ? Number(monthMatch[2]) : thisYear;
    if (month >= 1 && month <= 12) {
      return buildMonthWindow(year, month);
    }
  }

  return null;
}

function parseNoteStatus(text: string): 'open' | 'in_progress' | 'resolved' | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('in progress')) return 'in_progress';
  if (lower.includes('resolved') || lower.includes('closed')) return 'resolved';
  if (lower.includes('open')) return 'open';
  return undefined;
}

export function parseAiMemoryIntent(message: string, now = new Date()): AiMemoryQueryIntent | null {
  const normalized = message.toLowerCase();

  const asksForNotes =
    /\b(note|notes|idea|ideas|inspection notes?)\b/.test(normalized) &&
    /\b(show|list|find|get|recall|what|which|all)\b/.test(normalized);
  if (asksForNotes) {
    const monthWindow = parseMonthWindow(normalized, now);
    if (monthWindow) {
      return {
        type: 'list_notes_by_month',
        monthWindow,
        noteStatus: parseNoteStatus(normalized),
      };
    }
  }

  const asksForExpiring =
    /\b(expire|expires|expiring|expiration)\b/.test(normalized) &&
    /\b(extinguisher|extinguishers)\b/.test(normalized);
  if (asksForExpiring) {
    let targetYear: number | null = null;
    if (normalized.includes('next year')) {
      targetYear = now.getUTCFullYear() + 1;
    } else if (normalized.includes('this year')) {
      targetYear = now.getUTCFullYear();
    } else {
      const match = normalized.match(/\b(20\d{2})\b/);
      if (match) targetYear = Number(match[1]);
    }

    if (targetYear) {
      return {
        type: 'list_expiring_by_year',
        targetYear,
      };
    }
  }

  const asksForReplacementCount =
    /\b(how many|count|number)\b/.test(normalized) &&
    /\b(replace|replaced|replacement|replacements)\b/.test(normalized) &&
    /\b(extinguisher|extinguishers)\b/.test(normalized);
  if (asksForReplacementCount) {
    const monthWindow = parseMonthWindow(normalized, now);
    if (monthWindow) {
      return {
        type: 'count_replacements_by_month',
        monthWindow,
      };
    }
  }

  return null;
}
