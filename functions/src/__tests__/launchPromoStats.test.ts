/**
 * @jest-environment node
 */
import {
  LAUNCH_PROMO_CODES,
  getLaunchPromoMaxCustomers,
} from '../billing/launchPromoStats.js';

describe('launchPromoStats', () => {
  it('includes all EX3 launch promotion codes', () => {
    expect(LAUNCH_PROMO_CODES.has('EX3BASIC50')).toBe(true);
    expect(LAUNCH_PROMO_CODES.has('EX3PRO50')).toBe(true);
    expect(LAUNCH_PROMO_CODES.has('EX3ELITE50')).toBe(true);
  });

  it('defaults max customers to 100', () => {
    const prev = process.env.LAUNCH_PROMO_MAX_CUSTOMERS;
    delete process.env.LAUNCH_PROMO_MAX_CUSTOMERS;
    expect(getLaunchPromoMaxCustomers()).toBe(100);
    process.env.LAUNCH_PROMO_MAX_CUSTOMERS = prev;
  });
});
