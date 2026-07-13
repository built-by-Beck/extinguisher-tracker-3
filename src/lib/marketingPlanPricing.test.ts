import { describe, expect, it, vi } from 'vitest';

vi.mock('./billingConfig.ts', () => ({
  LAUNCH_PROMO_ENABLED: true,
  applyLaunchPromoDiscount: (amount: number) =>
    Math.round(amount * 0.5 * 100) / 100,
  formatUsd: (amount: number) => {
    return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
  },
}));

import { marketingPriceForInterval } from './marketingPlanPricing.ts';

describe('marketingPriceForInterval launch promo', () => {
  it('shows half monthly price as hero with regular struck through', () => {
    const display = marketingPriceForInterval(129.99, 'month');
    expect(display.priceLabel).toBe('$65');
    expect(display.regularPriceLabel).toBe('$129.99');
    expect(display.priceDetail).toBe('per month · first year');
    expect(display.promoCode).toBeUndefined();
    expect(display.promoDisclaimer).toBeUndefined();
  });

  it('shows discounted yearly equivalent when interval is year', () => {
    const display = marketingPriceForInterval(129.99, 'year');
    expect(display.regularPriceLabel).toBe('$116.99');
    expect(display.priceLabel).toBe('$58.50');
    expect(display.footnote).toContain('First year billed at $701.95');
    expect(display.footnote).toContain('then $1403.89/yr');
  });
});
