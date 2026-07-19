import { describe, expect, it } from 'vitest';
import {
  classifyNoteContent,
  formatClassificationSummary,
} from './aiNoteClassifier.ts';

describe('aiNoteClassifier', () => {
  it('classifies maintenance and asset references', () => {
    const result = classifyNoteContent(
      'FE-042 hydro stamp is illegible on 3rd floor',
    );
    expect(result.category).toBe('maintenance');
    expect(result.relatedEntityLabel).toBe('FE-042');
    expect(result.priority).toBe('normal');
  });

  it('flags safety notes as high priority', () => {
    const result = classifyNoteContent('Immediate safety hazard blocking exit');
    expect(result.category).toBe('safety');
    expect(result.priority).toBe('high');
  });

  it('formats classification summary', () => {
    const summary = formatClassificationSummary({
      category: 'tagging',
      priority: 'high',
      relatedEntityLabel: 'FE-001',
      tags: ['FE-001', 'tagging'],
    });
    expect(summary).toContain('tagging');
    expect(summary).toContain('high priority');
    expect(summary).toContain('FE-001');
  });
});
