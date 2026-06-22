import { Link, type LinkProps } from 'react-router-dom';
import type { BillingIntervalPreference } from '../../lib/billingIntervalPreference.ts';

type MarketingSignupLinkProps = Omit<LinkProps, 'to'> & {
  interval?: BillingIntervalPreference;
  planId?: string;
  /** Monthly Pro no-card trial funnel (forces month + pro). */
  proTrial?: boolean;
};

export function MarketingSignupLink({
  interval = 'year',
  planId,
  proTrial = false,
  children,
  className,
  ...rest
}: MarketingSignupLinkProps) {
  const resolvedInterval: BillingIntervalPreference = proTrial
    ? 'month'
    : interval;
  const resolvedPlan = proTrial ? 'pro' : planId;
  const params = new URLSearchParams({ billingInterval: resolvedInterval });
  if (resolvedPlan) params.set('plan', resolvedPlan);
  const to = `/signup?${params.toString()}`;

  return (
    <Link to={to} className={className} {...rest}>
      {children}
    </Link>
  );
}
