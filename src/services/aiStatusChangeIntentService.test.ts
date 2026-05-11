import { describe, expect, it } from 'vitest';
import { parseAiExtinguisherStatusChangeIntent } from './aiStatusChangeIntentService.ts';

describe('parseAiExtinguisherStatusChangeIntent', () => {
  it('parses set asset … to active', () => {
    expect(
      parseAiExtinguisherStatusChangeIntent('Set asset FE-001 to active'),
    ).toEqual({ assetId: 'FE-001', newStatus: 'active' });
  });

  it('parses extinguisher id … to spare', () => {
    expect(
      parseAiExtinguisherStatusChangeIntent(
        'Change extinguisher id abc123def456 to spare',
      ),
    ).toEqual({ extinguisherId: 'abc123def456', newStatus: 'spare' });
  });

  it('parses out of service', () => {
    expect(
      parseAiExtinguisherStatusChangeIntent(
        'Mark asset TAG-9 as out of service',
      ),
    ).toEqual({ assetId: 'TAG-9', newStatus: 'out_of_service' });
  });

  it('returns null without imperative verb', () => {
    expect(
      parseAiExtinguisherStatusChangeIntent(
        'What is the status of asset FE-001?',
      ),
    ).toBeNull();
  });

  it('returns null for memory-style lists', () => {
    expect(
      parseAiExtinguisherStatusChangeIntent(
        'Show me all active extinguishers in Building A',
      ),
    ).toBeNull();
  });
});
