/**
 * Whether a new checkout should include a free trial (one per org).
 */
export function isTrialEligible(orgData: {
  trialUsedAt?: unknown;
  stripeSubscriptionId?: string | null;
  plan?: string | null;
}): boolean {
  if (orgData.trialUsedAt != null) {
    return false;
  }
  if (orgData.stripeSubscriptionId) {
    return false;
  }
  if (orgData.plan != null && orgData.plan !== '') {
    return false;
  }
  return true;
}
