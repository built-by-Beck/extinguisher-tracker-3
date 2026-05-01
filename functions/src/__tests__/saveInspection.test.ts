/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { adminDb } from '../utils/admin.js';
import { saveInspection } from '../inspections/saveInspection.js';
import fft from 'firebase-functions-test';

const testEnv = fft();

// Manually mock adminDb
adminDb.runTransaction = jest.fn();
adminDb.doc = jest.fn();
adminDb.collection = jest.fn();

describe('saveInspection Atomicity Logic', () => {
  const orgId = 'test-org';
  const inspectionId = 'test-insp';
  const uid = 'user-1';
  const email = 'user@test.com';

  const wrapped = testEnv.wrap(saveInspection);

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock collection chain: adminDb.collection().doc()
    const mockDocRef = { id: 'mock-doc-id' };
    const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
    adminDb.collection.mockReturnValue(mockCollection);
  });

  it('should execute all updates within a single transaction', async () => {
    // Mock membership check
    const mockMemberDoc = { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ role: 'inspector', status: 'active' }) }) };
    
    // Mock transaction operations
    const mockTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };

    const mockOrgSnap = { exists: true, data: () => ({ subscriptionStatus: 'active' }) };
    const mockInspSnap = { exists: true, data: () => ({ status: 'pending', workspaceId: 'ws-1', extinguisherId: 'ext-1', assetId: 'A1' }) };
    const mockWsSnap = { exists: true, data: () => ({ status: 'active' }) };
    const mockExtSnap = { exists: true, data: () => ({ lifecycleStatus: 'active' }) };

    mockTx.get
      .mockResolvedValueOnce(mockOrgSnap)
      .mockResolvedValueOnce(mockInspSnap)
      .mockResolvedValueOnce(mockWsSnap)
      .mockResolvedValueOnce(mockExtSnap)
      .mockResolvedValueOnce(mockOrgSnap);

    adminDb.runTransaction.mockImplementation(async (cb) => await cb(mockTx));
    adminDb.doc.mockReturnValue(mockMemberDoc);

    const result = await wrapped({
      auth: { uid, token: { email } },
      data: {
        orgId,
        inspectionId,
        status: 'pass',
      },
    });

    expect(result).toEqual({ inspectionId, status: 'pass', previousStatus: 'pending' });
    
    // Verify updates were routed through the transaction
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.set).toHaveBeenCalled();
  });

  it('should fail if the workspace is archived', async () => {
    const mockMemberDoc = { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ role: 'inspector', status: 'active' }) }) };
    const mockTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };

    const mockOrgSnap = { exists: true, data: () => ({ subscriptionStatus: 'active' }) };
    const mockInspSnap = { exists: true, data: () => ({ status: 'pending', workspaceId: 'ws-1', extinguisherId: 'ext-1' }) };
    const mockWsSnap = { exists: true, data: () => ({ status: 'archived' }) };
    const mockExtSnap = { exists: true, data: () => ({ lifecycleStatus: 'active' }) };

    mockTx.get
      .mockResolvedValueOnce(mockOrgSnap)
      .mockResolvedValueOnce(mockInspSnap)
      .mockResolvedValueOnce(mockWsSnap)
      .mockResolvedValueOnce(mockExtSnap)
      .mockResolvedValueOnce(mockOrgSnap);

    adminDb.runTransaction.mockImplementation(async (cb) => await cb(mockTx));
    adminDb.doc.mockReturnValue(mockMemberDoc);

    await expect(wrapped({
      auth: { uid, token: { email } },
      data: { orgId, inspectionId, status: 'pass' },
    })).rejects.toThrow(/Cannot modify inspections in an archived workspace/);
    
    expect(mockTx.update).not.toHaveBeenCalled();
  });
});
