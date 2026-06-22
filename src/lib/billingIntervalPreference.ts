/**
 * Persists monthly vs yearly billing choice across marketing → signup → Settings.
 *
 * Author: built_by_Beck
 */

export type BillingIntervalPreference = 'month' | 'year';

const STORAGE_KEY = 'ex3_billing_interval';
const QUERY_KEY = 'billingInterval';

export function isBillingInterval(
  value: string | null | undefined,
): value is BillingIntervalPreference {
  return value === 'month' || value === 'year';
}

export function readBillingIntervalPreference(): BillingIntervalPreference {
  if (typeof window === 'undefined') return 'year';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isBillingInterval(stored)) return stored;
  } catch {
    // ignore private mode / blocked storage
  }
  return 'year';
}

export function writeBillingIntervalPreference(
  interval: BillingIntervalPreference,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, interval);
  } catch {
    // ignore
  }
}

export function billingIntervalFromSearchParams(
  params: URLSearchParams,
): BillingIntervalPreference | null {
  const raw = params.get(QUERY_KEY);
  return isBillingInterval(raw) ? raw : null;
}

/** Append `billingInterval` query param when not default month (year is explicit). */
export function withBillingIntervalQuery(
  path: string,
  interval: BillingIntervalPreference,
): string {
  const [base, hash = ''] = path.split('#');
  const [pathname, search = ''] = base.split('?');
  const params = new URLSearchParams(search);
  params.set(QUERY_KEY, interval);
  const query = params.toString();
  const built = query ? `${pathname}?${query}` : pathname;
  return hash ? `${built}#${hash}` : built;
}

export function settingsBillingPath(
  interval?: BillingIntervalPreference,
): string {
  const params = new URLSearchParams({ billing: '1' });
  if (interval) params.set(QUERY_KEY, interval);
  return `/dashboard/settings?${params.toString()}`;
}
