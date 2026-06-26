import { describe, expect, it, vi } from 'vitest';

vi.mock('./billingConfig.ts', () => ({
  LAUNCH_PROMO_ENABLED: true,
  applyLaunchPromoDiscount: (amount: number) =>
    Math.round(amount * 0.5 * 100) / 100,
  formatUsd: (amount: number) =>
    amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`,
  getLaunchPromoCode: (planId: string) => `EX3${planId.toUpperCase()}50`,
}));

import { marketingPriceForInterval } from './marketingPlanPricing.ts';

describe('marketingPriceForInterval launch promo', () => {
  it('shows half monthly price as hero with regular struck through', () => {
    const display = marketingPriceForInterval(129.99, 'month', 'pro');
    expect(display.priceLabel).toBe('$65');
    expect(display.regularPriceLabel).toBe('$129.99');
    expect(display.promoCode).toBe('EX3PRO50');
  });

  it('shows discounted yearly equivalent when interval is year', () => {
    const display = marketingPriceForInterval(129.99, 'year', 'pro');
    expect(display.regularPriceLabel).toBe('$116.99');
    expect(display.priceLabel).toBe('$58.50');
    expect(display.footnote).toContain('first year');
  });

  it('falls back to regular pricing when plan id is omitted', () => {
    const display = marketingPriceForInterval(129.99, 'month');
    expect(display.priceLabel).toBe('$129.99');
    expect(display.regularPriceLabel).toBeUndefined();
  });
});
