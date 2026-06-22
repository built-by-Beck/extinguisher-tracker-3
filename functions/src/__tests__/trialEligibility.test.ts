import { describe, it, expect } from '@jest/globals';
import { isTrialEligible } from '../billing/trialEligibility.js';

describe('isTrialEligible', () => {
  it('allows trial for a fresh org', () => {
    expect(isTrialEligible({})).toBe(true);
    expect(
      isTrialEligible({
        trialUsedAt: null,
        stripeSubscriptionId: null,
        plan: null,
      }),
    ).toBe(true);
  });

  it('denies trial after trialUsedAt is set', () => {
    expect(isTrialEligible({ trialUsedAt: new Date() })).toBe(false);
  });

  it('denies trial if subscription id exists', () => {
    expect(isTrialEligible({ stripeSubscriptionId: 'sub_123' })).toBe(false);
  });

  it('denies trial if plan is already assigned', () => {
    expect(isTrialEligible({ plan: 'basic' })).toBe(false);
  });
});
