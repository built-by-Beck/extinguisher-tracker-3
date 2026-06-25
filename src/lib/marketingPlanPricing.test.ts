import { describe, expect, it } from 'vitest';

import { marketingPriceForInterval } from './marketingPlanPricing.ts';

describe('marketingPriceForInterval launch promo', () => {
  it('shows half monthly price as hero with regular struck through', () => {
    const display = marketingPriceForInterval(129.99, 'month', 'pro');
    expect(display.priceLabel).toBe('$65');
    expect(display.regularPriceLabel).toBe('$129.99');
    expect(display.promoBadge).toBe('50% off year 1');
    expect(display.promoCode).toBe('EX3PRO50');
    expect(display.promoDisclaimer).toContain('After 12 months');
  });

  it('shows discounted yearly equivalent when interval is year', () => {
    const display = marketingPriceForInterval(129.99, 'year', 'pro');
    expect(display.regularPriceLabel).toBe('$116.99');
    expect(display.priceLabel).toBe('$58.50');
    expect(display.footnote).toContain('First year');
  });

  it('falls back to regular pricing when plan id is omitted', () => {
    const display = marketingPriceForInterval(129.99, 'month');
    expect(display.priceLabel).toBe('$129.99');
    expect(display.regularPriceLabel).toBeUndefined();
  });
});
