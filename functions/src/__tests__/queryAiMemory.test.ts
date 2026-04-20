/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fft from 'firebase-functions-test';
import { queryAiMemory } from '../ai/queryAiMemory.js';
import { adminDb } from '../utils/admin.js';

const testEnv = fft();

adminDb.doc = jest.fn();
adminDb.collection = jest.fn();

describe('queryAiMemory callable', () => {
  const wrapped = testEnv.wrap(queryAiMemory);
  const orgId = 'org-1';
  const uid = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns expiring extinguisher results for supported deterministic intent', async () => {
    const orgDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ plan: 'pro', subscriptionStatus: 'active' }),
      }),
    };
    const memberDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ role: 'inspector', status: 'active' }),
      }),
    };

    const expiringSnap = {
      docs: [
        {
          id: 'ext-1',
          data: () => ({
            assetId: 'A-100',
            serial: 'S-100',
            section: 'Lobby',
            parentLocation: 'Main',
            expirationYear: 2027,
            lifecycleStatus: 'active',
            complianceStatus: 'compliant',
          }),
        },
      ],
    };

    const extinguisherQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(expiringSnap),
    };

    adminDb.doc.mockImplementation((path) => {
      if (path === `org/${orgId}`) return orgDoc;
      if (path === `org/${orgId}/members/${uid}`) return memberDoc;
      return orgDoc;
    });

    adminDb.collection.mockImplementation((path) => {
      if (path === `org/${orgId}/extinguishers`) return extinguisherQuery;
      return extinguisherQuery;
    });

    const result = await wrapped({
      auth: { uid, token: { email: 'a@b.com' } },
      data: {
        orgId,
        intent: { type: 'list_expiring_by_year', targetYear: 2027 },
      },
    });

    expect(result.intentType).toBe('list_expiring_by_year');
    expect(result.count).toBe(1);
    expect(result.expiringExtinguishers[0].assetId).toBe('A-100');
  });

  it('throws for unsupported intent', async () => {
    const orgDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ plan: 'pro', subscriptionStatus: 'active' }),
      }),
    };
    const memberDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ role: 'inspector', status: 'active' }),
      }),
    };
    const fakeCollection = { where: jest.fn().mockReturnThis(), get: jest.fn() };

    adminDb.doc.mockImplementation((path) => {
      if (path === `org/${orgId}`) return orgDoc;
      if (path === `org/${orgId}/members/${uid}`) return memberDoc;
      return orgDoc;
    });
    adminDb.collection.mockReturnValue(fakeCollection);

    await expect(
      wrapped({
        auth: { uid, token: { email: 'a@b.com' } },
        data: {
          orgId,
          intent: { type: 'unsupported_intent' },
        },
      }),
    ).rejects.toThrow(/Unsupported intent type/);
  });
});
