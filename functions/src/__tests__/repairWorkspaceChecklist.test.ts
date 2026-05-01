/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fft from 'firebase-functions-test';
import { adminDb } from '../utils/admin.js';
import { repairWorkspaceChecklist } from '../inspections/recalculateWorkspaceStats.js';

const testEnv = fft();

adminDb.doc = jest.fn();
adminDb.collection = jest.fn();
adminDb.batch = jest.fn();

describe('repairWorkspaceChecklist', () => {
  const wrapped = testEnv.wrap(repairWorkspaceChecklist);
  const baseRequest = {
    auth: { uid: 'owner-1', token: { email: 'owner@test.com' } },
    data: {
      orgId: 'org-1',
      workspaceId: '2026-04',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setup({
    workspaceStatus = 'active',
    inspections = [],
    ext2NextMonthlyInspection = null,
    extinguisherDocs,
  }: {
    workspaceStatus?: string;
    inspections?: Array<{ id: string; data: Record<string, unknown> }>;
    ext2NextMonthlyInspection?: unknown;
    extinguisherDocs?: Array<{ id: string; data: Record<string, unknown> }>;
  } = {}) {
    const memberSnap = { exists: true, data: () => ({ role: 'owner', status: 'active' }) };
    const orgSnap = { exists: true, data: () => ({ subscriptionStatus: 'active' }) };
    const wsRef = {
      path: 'org/org-1/workspaces/2026-04',
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ status: workspaceStatus }) }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    adminDb.doc.mockImplementation((path: string) => {
      if (path === 'org/org-1/members/owner-1') return { path, get: jest.fn().mockResolvedValue(memberSnap) };
      if (path === 'org/org-1') return { path, get: jest.fn().mockResolvedValue(orgSnap) };
      if (path === 'org/org-1/workspaces/2026-04') return wsRef;
      return { path };
    });

    const extDocs = (extinguisherDocs ?? [
      {
        id: 'ext-1',
        data: () => ({
          assetId: 'FE-001',
          category: 'standard',
          lifecycleStatus: 'active',
          status: 'active',
          deletedAt: null,
          nextMonthlyInspection: null,
        }),
      },
      {
        id: 'ext-2',
        data: () => ({
          assetId: 'FE-002',
          category: 'standard',
          lifecycleStatus: 'active',
          status: 'active',
          deletedAt: null,
          nextMonthlyInspection: ext2NextMonthlyInspection,
        }),
      },
    ]).map((row) => ({
      id: row.id,
      data: typeof row.data === 'function' ? row.data : () => row.data,
    }));
    const inspDocs = inspections.map((row) => ({
      id: row.id,
      data: () => row.data,
      ref: { path: `org/org-1/inspections/${row.id}` },
    }));

    const collectionGetByPath = new Map<string, jest.Mock>([
      ['org/org-1/extinguishers', jest.fn().mockResolvedValue({ docs: extDocs })],
      ['org/org-1/inspections', jest.fn().mockResolvedValueOnce({ docs: inspDocs }).mockResolvedValue({ docs: inspDocs })],
    ]);
    adminDb.collection.mockImplementation((path: string) => ({
      where: jest.fn().mockReturnThis(),
      get: collectionGetByPath.get(path),
    }));

    const batch = {
      set: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    adminDb.batch.mockReturnValue(batch);
    return { batch, wsRef };
  }

  it('recalculates without backfilling missing inventory rows', async () => {
    const { batch, wsRef } = setup({
      inspections: [
        {
          id: 'checked-ext-1',
          data: {
            targetType: 'extinguisher',
            extinguisherId: 'ext-1',
            workspaceId: '2026-04',
            status: 'pass',
          },
        },
      ],
    });

    const result = await wrapped(baseRequest);

    expect(result.rowsCreated).toBe(0);
    expect(batch.set).not.toHaveBeenCalled();
    expect(wsRef.update).toHaveBeenCalled();
  });

  it('rejects archived workspaces before changing checklist scope', async () => {
    const { batch } = setup({ workspaceStatus: 'archived' });

    await expect(wrapped(baseRequest)).rejects.toThrow(/Repair is only supported for active workspaces/);
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('does not use Next Inspection to backfill missing extinguishers', async () => {
    const { batch } = setup({
      inspections: [
        {
          id: 'checked-ext-1',
          data: {
            targetType: 'extinguisher',
            extinguisherId: 'ext-1',
            workspaceId: '2026-04',
            status: 'pass',
          },
        },
      ],
      ext2NextMonthlyInspection: { seconds: 1775001600, nanoseconds: 0 },
    });

    const result = await wrapped(baseRequest);

    expect(result.rowsCreated).toBe(0);
    expect(batch.set).not.toHaveBeenCalled();
  });

  it('does not backfill superseded active-stale extinguishers', async () => {
    const { batch } = setup({
      extinguisherDocs: [
        {
          id: 'old-stale',
          data: {
            assetId: 'FE-OLD',
            category: 'standard',
            lifecycleStatus: 'active',
            status: 'active',
            deletedAt: null,
            nextMonthlyInspection: null,
          },
        },
        {
          id: 'new-successor',
          data: {
            assetId: 'FE-OLD',
            category: 'standard',
            lifecycleStatus: 'active',
            status: 'active',
            deletedAt: null,
            nextMonthlyInspection: null,
            replacesExtId: 'old-stale',
          },
        },
      ],
    });

    const result = await wrapped(baseRequest);

    expect(result.rowsCreated).toBe(0);
    expect(batch.set).not.toHaveBeenCalled();
  });
});
