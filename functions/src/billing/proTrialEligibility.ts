/**
 * Pure helpers for Pro monthly no-card trial (server + tests).
 *
 * Author: built_by_Beck
 */

import type { BillingInterval, PlanName } from './planConfig.js';

export type OrgTrialGateFields = {
  stripeSubscriptionId?: string | null;
  proTrialConsumed?: boolean;
};

export function shouldUseProMonthlyTrial(
  plan: PlanName,
  billingInterval: BillingInterval,
  org: OrgTrialGateFields,
): boolean {
  return (
    plan === 'pro' &&
    billingInterval === 'month' &&
    org.proTrialConsumed !== true &&
    !org.stripeSubscriptionId
  );
}

export function proTrialDaysFromEnv(): number {
  const n = Number(process.env.PRO_TRIAL_DAYS);
  return Number.isFinite(n) && n > 0 && n <= 365 ? Math.floor(n) : 7;
}
