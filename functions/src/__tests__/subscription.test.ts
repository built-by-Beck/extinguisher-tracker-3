/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { jest, describe, it, expect } from '@jest/globals';
import { adminDb } from '../utils/admin.js';
import { validateSubscription, validateSubscriptionTx } from '../utils/subscription.js';

// Manually mock the doc method
adminDb.doc = jest.fn();

describe('Subscription Gating Logic', () => {
  const orgId = 'test-org';

  it('should allow active subscriptions', async () => {
    const mockDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          subscriptionStatus: 'active',
        }),
      }),
    };
    adminDb.doc.mockReturnValue(mockDoc);

    await expect(validateSubscription(orgId)).resolves.not.toThrow();
  });

  it('should allow trialing subscriptions', async () => {
    const mockDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          subscriptionStatus: 'trialing',
        }),
      }),
    };
    adminDb.doc.mockReturnValue(mockDoc);

    await expect(validateSubscription(orgId)).resolves.not.toThrow();
  });

  it('should block past_due subscriptions', async () => {
    const mockDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          subscriptionStatus: 'past_due',
        }),
      }),
    };
    adminDb.doc.mockReturnValue(mockDoc);

    await expect(validateSubscription(orgId))
      .rejects.toThrow(/An active subscription is required for this action/);
  });

  it('should block canceled subscriptions', async () => {
    const mockDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          subscriptionStatus: 'canceled',
        }),
      }),
    };
    adminDb.doc.mockReturnValue(mockDoc);

    await expect(validateSubscription(orgId))
      .rejects.toThrow(/An active subscription is required for this action/);
  });

  it('should block missing subscriptions', async () => {
    const mockDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          subscriptionStatus: null,
        }),
      }),
    };
    adminDb.doc.mockReturnValue(mockDoc);

    await expect(validateSubscription(orgId))
      .rejects.toThrow(/An active subscription is required for this action/);
  });

  it('should work within a transaction', async () => {
    const mockTx = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          subscriptionStatus: 'active',
        }),
      }),
    };
    adminDb.doc.mockReturnValue('mock-ref');

    await expect(validateSubscriptionTx(mockTx, orgId)).resolves.not.toThrow();
    expect(mockTx.get).toHaveBeenCalledWith('mock-ref');
  });
});
