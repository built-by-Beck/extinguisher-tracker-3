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
    const display = marketingPriceForInterval(100, 'month');
    expect(display.priceLabel).toBe('$50');
    expect(display.priceDetail).toBe('per month · first year');
    expect(display.regularPriceLabel).toBe('$100');
    expect(display.promoCode).toBeUndefined();
  });

  it('shows discounted yearly equivalent when interval is year', () => {
    const display = marketingPriceForInterval(100, 'year');
    expect(display.regularPriceLabel).toBe('$100');
    expect(display.priceLabel).toBe('$45');
    expect(display.footnote).toContain('First year');
    expect(display.footnote).toContain('$540');
  });

  it('applies the global launch promo without requiring a plan id', () => {
    const display = marketingPriceForInterval(80, 'month');
    expect(display.priceLabel).toBe('$40');
    expect(display.regularPriceLabel).toBe('$80');
  });
});
