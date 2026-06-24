import { describe, expect, it, vi } from 'vitest';

vi.mock('./billingConfig.ts', () => ({
  LAUNCH_PROMO_ENABLED: true,
  LAUNCH_PROMO_DISCOUNT_FRACTION: 0.5,
  getLaunchPromoCode: (planId: string) =>
    planId === 'basic'
      ? 'EX3BASIC50'
      : planId === 'pro'
        ? 'EX3PRO50'
        : 'EX3ELITE50',
  getLaunchPromoPriceDisclaimer: () =>
    '50% off your first year with code EX3PRO50 at checkout. After 12 months, billing returns to $99/mo.',
  launchPromoMonthlyPrice: (monthly: number) =>
    Math.round(monthly * 0.5 * 100) / 100,
}));

import { marketingPriceForInterval } from './marketingPlanPricing.ts';

describe('marketingPriceForInterval launch promo', () => {
  it('shows half monthly price as hero with regular struck through', () => {
    const display = marketingPriceForInterval(99, 'month', 'pro');
    expect(display.priceLabel).toBe('$49.50');
    expect(display.regularPriceLabel).toBe('$99');
    expect(display.promoBadge).toBe('50% off year 1');
    expect(display.promoCode).toBe('EX3PRO50');
    expect(display.promoDisclaimer).toContain('After 12 months');
  });

  it('shows discounted yearly equivalent when interval is year', () => {
    const display = marketingPriceForInterval(99, 'year', 'pro');
    expect(display.regularPriceLabel).toBe('$88.99');
    expect(display.priceLabel).toBe('$44.55');
    expect(display.footnote).toContain('first year');
  });

  it('falls back to regular pricing when plan id is omitted', () => {
    const display = marketingPriceForInterval(99, 'month');
    expect(display.priceLabel).toBe('$99');
    expect(display.regularPriceLabel).toBeUndefined();
  });
});
