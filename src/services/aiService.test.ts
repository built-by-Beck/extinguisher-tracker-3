import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askAssistant } from './aiService.ts';

const mocks = vi.hoisted(() => ({
  queryAiMemoryCall: vi.fn(),
}));

vi.mock('./aiQueryService.ts', () => ({
  queryAiMemoryCall: mocks.queryAiMemoryCall,
}));

vi.mock('../lib/firebase.ts', () => ({
  geminiModel: {
    startChat: vi.fn(),
    generateContent: vi.fn(),
  },
}));

describe('askAssistant deterministic memory formatting', () => {
  beforeEach(() => {
    mocks.queryAiMemoryCall.mockReset();
  });

  it('includes finder fields for extinguisher list responses', async () => {
    mocks.queryAiMemoryCall.mockResolvedValue({
      intentType: 'list_marked_expired',
      appliedFilters: {
        isExpired: true,
      },
      count: 1,
      expiredExtinguishers: [
        {
          id: 'ext-1',
          assetId: 'A-100',
          serial: 'S-100',
          parentLocation: 'Main Building',
          locationName: '',
          section: 'Lobby',
          vicinity: 'Beside front desk',
          manufactureYear: 2019,
          expirationYear: 2027,
          isExpired: true,
          lifecycleStatus: 'active',
          complianceStatus: 'compliant',
        },
      ],
    });

    const response = await askAssistant(
      [{ role: 'user', content: 'give me a printable list of all expired extinguishers' }],
      { orgId: 'org-1' },
    );

    expect(response).toContain('asset number: A-100');
    expect(response).toContain('serial number: S-100');
    expect(response).toContain('location: Main Building');
    expect(response).toContain('vicinity: Beside front desk');
  });
});
