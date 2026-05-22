/**
 * @jest-environment node
 */
import {
  proTrialDaysFromEnv,
  shouldUseProMonthlyTrial,
} from '../billing/proTrialEligibility.js';

describe('shouldUseProMonthlyTrial', () => {
  const baseOrg = { stripeSubscriptionId: null as string | null, proTrialConsumed: false };

  it('is true for Pro monthly with no subscription and trial not consumed', () => {
    expect(
      shouldUseProMonthlyTrial('pro', 'month', baseOrg),
    ).toBe(true);
  });

  it('is false when not Pro', () => {
    expect(
      shouldUseProMonthlyTrial('basic', 'month', baseOrg),
    ).toBe(false);
  });

  it('is false for yearly Pro', () => {
    expect(
      shouldUseProMonthlyTrial('pro', 'year', baseOrg),
    ).toBe(false);
  });

  it('is false when org already has a Stripe subscription', () => {
    expect(
      shouldUseProMonthlyTrial('pro', 'month', {
        stripeSubscriptionId: 'sub_123',
        proTrialConsumed: false,
      }),
    ).toBe(false);
  });

  it('is false when Pro trial was already consumed', () => {
    expect(
      shouldUseProMonthlyTrial('pro', 'month', {
        stripeSubscriptionId: null,
        proTrialConsumed: true,
      }),
    ).toBe(false);
  });
});

describe('proTrialDaysFromEnv', () => {
  const prev = process.env.PRO_TRIAL_DAYS;

  afterEach(() => {
    process.env.PRO_TRIAL_DAYS = prev;
  });

  it('defaults to 7 when unset', () => {
    delete process.env.PRO_TRIAL_DAYS;
    expect(proTrialDaysFromEnv()).toBe(7);
  });

  it('respects PRO_TRIAL_DAYS when valid', () => {
    process.env.PRO_TRIAL_DAYS = '14';
    expect(proTrialDaysFromEnv()).toBe(14);
  });
});
