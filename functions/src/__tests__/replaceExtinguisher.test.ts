/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fft from 'firebase-functions-test';
import { adminDb } from '../utils/admin.js';
import { replaceExtinguisher } from '../lifecycle/replaceExtinguisher.js';

const testEnv = fft();

adminDb.doc = jest.fn();
adminDb.collection = jest.fn();
adminDb.runTransaction = jest.fn();

describe('replaceExtinguisher', () => {
  const wrapped = testEnv.wrap(replaceExtinguisher);
  const baseRequest = {
    auth: { uid: 'owner-1', token: { email: 'owner@test.com' } },
    data: {
      orgId: 'org-1',
      oldExtinguisherId: 'ext-1',
      newExtinguisherData: {
        assetId: 'FE-001',
        serial: 'NEW-SERIAL',
        barcode: 'NEW-BARCODE',
        manufacturer: 'Amerex',
        extinguisherType: 'ABC',
      },
      reason: 'Damaged',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeQuery(path: string, conditions: Array<{ field: string; value: unknown }> = []) {
    return {
      path,
      _conditions: conditions,
      where: jest.fn((field: string, _op: string, value: unknown) => makeQuery(path, [...conditions, { field, value }])),
      limit: jest.fn(() => makeQuery(path, conditions)),
    };
  }

  function setup({ oldData }: { oldData: Record<string, unknown> }) {
    const memberSnap = { exists: true, data: () => ({ role: 'owner', status: 'active' }) };
    const orgSnap = { exists: true, data: () => ({ subscriptionStatus: 'active' }) };
    const oldExtSnap = { exists: true, data: () => oldData };
    const extRef = { path: 'org/org-1/extinguishers/ext-1' };
    const histRef = { path: 'org/org-1/extinguishers/ext-1/replacementHistory/hist-1' };

    adminDb.doc.mockImplementation((path: string) => {
      if (path === 'org/org-1/members/owner-1') {
        return { path, get: jest.fn().mockResolvedValue(memberSnap) };
      }
      if (path === 'org/org-1') return { path };
      if (path === 'org/org-1/extinguishers/ext-1') return extRef;
      return { path };
    });

    adminDb.collection.mockImplementation((path: string) => {
      if (path === 'org/org-1/extinguishers/ext-1/replacementHistory') {
        return { doc: jest.fn(() => histRef) };
      }
      if (path === 'org/org-1/auditLogs') {
        return { doc: jest.fn(() => ({ path: 'org/org-1/auditLogs/audit-1' })) };
      }
      return makeQuery(path);
    });

    const tx = {
      get: jest.fn((refOrQuery: { path: string; _conditions?: Array<{ field: string; value: unknown }> }) => {
        if (refOrQuery.path === 'org/org-1') return Promise.resolve(orgSnap);
        if (refOrQuery.path === 'org/org-1/extinguishers/ext-1') return Promise.resolve(oldExtSnap);

        const conditions = refOrQuery._conditions ?? [];
        const assetMatch = conditions.some((condition) => condition.field === 'assetId' && condition.value === oldData.assetId);
        if (assetMatch) {
          return Promise.resolve({
            docs: [{ id: 'ext-1', data: () => oldData }],
          });
        }
        return Promise.resolve({ docs: [] });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    adminDb.runTransaction.mockImplementation(async (cb) => await cb(tx));
    return { tx, histRef };
  }

  it('replaces an active extinguisher in place and archives the prior snapshot', async () => {
    const oldData = {
      assetId: 'FE-001',
      serial: 'OLD-SERIAL',
      barcode: 'OLD-BARCODE',
      category: 'standard',
      lifecycleStatus: 'active',
      status: 'active',
      deletedAt: null,
    };
    const { tx, histRef } = setup({ oldData });

    const result = await wrapped(baseRequest);

    expect(result).toEqual({ extinguisherId: 'ext-1' });
    expect(tx.set).toHaveBeenCalledWith(
      histRef,
      expect.objectContaining({
        priorSnapshot: expect.objectContaining({ serial: 'OLD-SERIAL' }),
        previousSerial: 'OLD-SERIAL',
        previousBarcode: 'OLD-BARCODE',
        previousAssetId: 'FE-001',
        reason: 'Damaged',
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'org/org-1/extinguishers/ext-1' }),
      expect.objectContaining({
        assetId: 'FE-001',
        serial: 'NEW-SERIAL',
        barcode: 'NEW-BARCODE',
        lifecycleStatus: 'active',
        status: 'active',
        isActive: true,
      }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('/auditLogs/') }),
      expect.objectContaining({
        details: expect.objectContaining({
          oldAssetId: 'FE-001',
          newAssetId: 'FE-001',
          previousSerial: 'OLD-SERIAL',
          newSerial: 'NEW-SERIAL',
        }),
      }),
    );
  });

  it('returns a clear precondition error when the active extinguisher has no asset number', async () => {
    const { tx } = setup({
      oldData: {
        serial: 'OLD-SERIAL',
        category: 'standard',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      },
    });

    await expect(wrapped(baseRequest)).rejects.toThrow(/asset number is missing/i);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });
});
