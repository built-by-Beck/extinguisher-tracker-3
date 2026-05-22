import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askAssistant } from './aiService.ts';

const mocks = vi.hoisted(() => ({
  queryAiMemoryCall: vi.fn(),
  sendMessage: vi.fn(),
  startChat: vi.fn(),
  updateExtinguisherStatus: vi.fn(),
}));

vi.mock('./aiQueryService.ts', () => ({
  queryAiMemoryCall: mocks.queryAiMemoryCall,
}));

vi.mock('./lifecycleService.ts', () => ({
  updateExtinguisherStatus: mocks.updateExtinguisherStatus,
}));

vi.mock('../lib/firebase.ts', () => ({
  geminiModel: {
    startChat: mocks.startChat,
    generateContent: vi.fn(),
  },
}));

describe('askAssistant deterministic memory formatting', () => {
  beforeEach(() => {
    mocks.queryAiMemoryCall.mockReset();
    mocks.updateExtinguisherStatus.mockReset();
    mocks.sendMessage.mockReset();
    mocks.startChat.mockReset();
    mocks.sendMessage.mockResolvedValue({
      response: {
        text: () => 'Vision response',
      },
    });
    mocks.startChat.mockReturnValue({
      sendMessage: mocks.sendMessage,
    });
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
      [
        {
          role: 'user',
          content: 'give me a printable list of all expired extinguishers',
        },
      ],
      { orgId: 'org-1' },
    );

    expect(response).toContain('asset number: A-100');
    expect(response).toContain('serial number: S-100');
    expect(response).toContain('location: Main Building');
    expect(response).toContain('vicinity: Beside front desk');
  });

  it('skips deterministic memory and sends Gemini image parts for photo questions', async () => {
    const response = await askAssistant(
      [
        {
          role: 'user',
          content:
            'give me a printable list of all expired extinguishers in this photo',
          imageAttachments: [
            {
              mimeType: 'image/jpeg',
              data: 'base64-image-data',
              name: 'extinguisher.jpg',
              size: 1024,
            },
          ],
        },
      ],
      { orgId: 'org-1' },
    );

    expect(response).toBe('Vision response');
    expect(mocks.queryAiMemoryCall).not.toHaveBeenCalled();
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).toHaveBeenCalledWith([
      expect.objectContaining({
        text: expect.stringContaining('give me a printable list'),
      }),
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: 'base64-image-data',
        },
      },
    ]);
  });

  it('updates extinguisher status deterministically when owner/admin intent matches', async () => {
    mocks.updateExtinguisherStatus.mockResolvedValue({
      extinguisherId: 'ext-99',
      assetId: 'FE-001',
      newStatus: 'active',
      unchanged: false,
    });

    const response = await askAssistant(
      [{ role: 'user', content: 'Set asset FE-001 to active' }],
      { orgId: 'org-1', canMutateInventory: true },
    );

    expect(mocks.updateExtinguisherStatus).toHaveBeenCalledWith('org-1', {
      extinguisherId: undefined,
      assetId: 'FE-001',
      newStatus: 'active',
      reason: 'AI assistant user request',
    });
    expect(mocks.queryAiMemoryCall).not.toHaveBeenCalled();
    expect(response).toContain('Updated extinguisher');
    expect(response).toContain('FE-001');
  });
});
