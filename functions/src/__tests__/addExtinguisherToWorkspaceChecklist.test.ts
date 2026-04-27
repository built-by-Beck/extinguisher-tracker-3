/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fft from 'firebase-functions-test';
import { adminDb } from '../utils/admin.js';
import { addExtinguisherToWorkspaceChecklist } from '../inspections/addExtinguisherToWorkspaceChecklist.js';

const testEnv = fft();

adminDb.doc = jest.fn();
adminDb.collection = jest.fn();
adminDb.runTransaction = jest.fn();

describe('addExtinguisherToWorkspaceChecklist', () => {
  const wrapped = testEnv.wrap(addExtinguisherToWorkspaceChecklist);
  const baseRequest = {
    auth: { uid: 'owner-1', token: { email: 'owner@test.com' } },
    data: {
      orgId: 'org-1',
      workspaceId: '2026-04',
      extinguisherId: 'ext-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupDocs({
    memberRole = 'owner',
    workspaceStatus = 'active',
    deterministicExists = false,
    legacyExists = false,
  }: {
    memberRole?: string;
    workspaceStatus?: string;
    deterministicExists?: boolean;
    legacyExists?: boolean;
  } = {}) {
    const refs = new Map<string, { path: string }>();
    adminDb.doc.mockImplementation((path: string) => {
      const ref = { path };
      refs.set(path, ref);
      return ref;
    });

    const memberSnap = { exists: true, data: () => ({ role: memberRole, status: 'active' }) };
    const orgSnap = { exists: true, data: () => ({ subscriptionStatus: 'active' }) };
    const wsSnap = { exists: true, data: () => ({ status: workspaceStatus }) };
    const extSnap = {
      exists: true,
      data: () => ({
        assetId: 'FE-001',
        category: 'standard',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      }),
    };
    const inspSnap = { exists: deterministicExists, data: () => ({}) };

    const directSnaps = new Map<string, unknown>([
      ['org/org-1/members/owner-1', memberSnap],
      ['org/org-1', orgSnap],
      ['org/org-1/workspaces/2026-04', wsSnap],
      ['org/org-1/extinguishers/ext-1', extSnap],
    ]);

    adminDb.doc.mockImplementation((path: string) => ({
      path,
      get: jest.fn().mockResolvedValue(directSnaps.get(path)),
    }));

    const legacyGet = jest.fn().mockResolvedValue(
      legacyExists
        ? { empty: false, docs: [{ id: 'legacy-row' }] }
        : { empty: true, docs: [] },
    );
    const legacyChain = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: legacyGet,
    };
    adminDb.collection.mockReturnValue(legacyChain);

    const tx = {
      get: jest.fn((ref: { path: string }) => {
        if (ref.path === 'org/org-1') return Promise.resolve(orgSnap);
        if (ref.path === 'org/org-1/workspaces/2026-04') return Promise.resolve(wsSnap);
        if (ref.path === 'org/org-1/extinguishers/ext-1') return Promise.resolve(extSnap);
        if (ref.path === 'org/org-1/inspections/ext_ext-1_2026-04') return Promise.resolve(inspSnap);
        return Promise.resolve({ exists: false, data: () => ({}) });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    adminDb.runTransaction.mockImplementation(async (cb) => await cb(tx));
    return { tx, legacyGet, refs };
  }

  it('creates one deterministic pending row and updates stats', async () => {
    const { tx } = setupDocs();

    const result = await wrapped(baseRequest);

    expect(result).toEqual({
      inspectionId: 'ext_ext-1_2026-04',
      created: true,
      alreadyExisted: false,
    });
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'org/org-1/inspections/ext_ext-1_2026-04' }),
      expect.objectContaining({
        targetType: 'extinguisher',
        extinguisherId: 'ext-1',
        workspaceId: '2026-04',
        status: 'pending',
      }),
    );
    expect(tx.update).toHaveBeenCalled();
  });

  it('returns alreadyExisted for deterministic retry without incrementing stats', async () => {
    const { tx } = setupDocs({ deterministicExists: true });

    const result = await wrapped(baseRequest);

    expect(result).toEqual({
      inspectionId: 'ext_ext-1_2026-04',
      created: false,
      alreadyExisted: true,
    });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects archived workspaces before legacy already-exists acknowledgement', async () => {
    setupDocs({ workspaceStatus: 'archived', legacyExists: true });

    await expect(wrapped(baseRequest)).rejects.toThrow(/Only active workspaces/);
    expect(adminDb.runTransaction).not.toHaveBeenCalled();
  });
});
