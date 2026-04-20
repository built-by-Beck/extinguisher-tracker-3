import { describe, it, expect } from 'vitest';
import { parseAiMemoryIntent } from './aiQueryIntentService.ts';

describe('parseAiMemoryIntent', () => {
  it('parses notes by month intent', () => {
    const intent = parseAiMemoryIntent(
      'show all notes from this month',
      new Date(Date.UTC(2026, 3, 20)),
    );
    expect(intent?.type).toBe('list_notes_by_month');
    expect(intent?.monthWindow?.year).toBe(2026);
    expect(intent?.monthWindow?.month).toBe(4);
  });

  it('parses expiring next year intent', () => {
    const intent = parseAiMemoryIntent(
      'show extinguishers that expire next year',
      new Date(Date.UTC(2026, 3, 20)),
    );
    expect(intent).toEqual({
      type: 'list_expiring_by_year',
      targetYear: 2027,
    });
  });

  it('parses replacement count with last month', () => {
    const intent = parseAiMemoryIntent(
      'how many extinguishers did we replace last month?',
      new Date(Date.UTC(2026, 3, 20)),
    );
    expect(intent?.type).toBe('count_replacements_by_month');
    expect(intent?.monthWindow?.year).toBe(2026);
    expect(intent?.monthWindow?.month).toBe(3);
  });

  it('returns null for generic questions', () => {
    const intent = parseAiMemoryIntent('explain NFPA 10 annual requirements');
    expect(intent).toBeNull();
  });
});
