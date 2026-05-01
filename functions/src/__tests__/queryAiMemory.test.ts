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

  it('returns only active extinguishers marked expired for official expired intent', async () => {
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

    const expiredSnap = {
      docs: [
        {
          id: 'ext-1',
          data: () => ({
            assetId: 'A-100',
            serial: 'S-100',
            section: 'Lobby',
            parentLocation: 'Main',
            manufactureYear: 2019,
            expirationYear: 2027,
            isExpired: true,
            lifecycleStatus: 'active',
            status: 'active',
            complianceStatus: 'compliant',
          }),
        },
        {
          id: 'ext-2',
          data: () => ({
            assetId: 'A-200',
            serial: 'S-200',
            section: 'Storage',
            parentLocation: 'Main',
            manufactureYear: 2018,
            isExpired: true,
            lifecycleStatus: 'retired',
            status: 'retired',
          }),
        },
      ],
    };

    const extinguisherQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(expiredSnap),
    };

    adminDb.doc.mockImplementation((path) => {
      if (path === `org/${orgId}`) return orgDoc;
      if (path === `org/${orgId}/members/${uid}`) return memberDoc;
      return orgDoc;
    });
    adminDb.collection.mockReturnValue(extinguisherQuery);

    const result = await wrapped({
      auth: { uid, token: { email: 'a@b.com' } },
      data: {
        orgId,
        intent: { type: 'list_marked_expired' },
      },
    });

    expect(result.intentType).toBe('list_marked_expired');
    expect(result.count).toBe(1);
    expect(result.expiredExtinguishers[0].assetId).toBe('A-100');
  });

  it('returns possible expired candidates without mixing official expired units', async () => {
    const recentManufactureYear = new Date().getUTCFullYear();
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

    const candidateSnap = {
      docs: [
        {
          id: 'ext-1',
          data: () => ({
            assetId: 'A-100',
            serial: 'S-100',
            section: 'Lobby',
            parentLocation: 'Main',
            manufactureYear: 2019,
            isExpired: false,
            lifecycleStatus: 'active',
            status: 'active',
          }),
        },
        {
          id: 'ext-2',
          data: () => ({
            assetId: 'A-200',
            serial: 'S-200',
            section: 'Storage',
            parentLocation: 'Main',
            manufactureYear: 2018,
            isExpired: true,
            lifecycleStatus: 'active',
            status: 'active',
          }),
        },
        {
          id: 'ext-3',
          data: () => ({
            assetId: 'A-300',
            serial: 'S-300',
            section: 'Office',
            parentLocation: 'Main',
            manufactureYear: recentManufactureYear,
            isExpired: false,
            lifecycleStatus: 'active',
            status: 'active',
          }),
        },
      ],
    };

    const extinguisherQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(candidateSnap),
    };

    adminDb.doc.mockImplementation((path) => {
      if (path === `org/${orgId}`) return orgDoc;
      if (path === `org/${orgId}/members/${uid}`) return memberDoc;
      return orgDoc;
    });
    adminDb.collection.mockReturnValue(extinguisherQuery);

    const result = await wrapped({
      auth: { uid, token: { email: 'a@b.com' } },
      data: {
        orgId,
        intent: { type: 'list_expired_candidates' },
      },
    });

    expect(result.intentType).toBe('list_expired_candidates');
    expect(result.count).toBe(1);
    expect(result.expiredCandidateExtinguishers[0].assetId).toBe('A-100');
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
