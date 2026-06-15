import { PlanSelector } from './PlanSelector.tsx';
import { ManageBilling } from './ManageBilling.tsx';
import { BillingStatus } from './BillingStatus.tsx';
import type { Organization } from '../../types/organization.ts';

type SubscriptionSectionProps = {
  org: Organization;
  isOwner: boolean;
  billingNotice?: string | null;
  billingNoticeTone?: 'success' | 'info';
};

export function SubscriptionSection({
  org,
  isOwner,
  billingNotice,
  billingNoticeTone = 'success',
}: SubscriptionSectionProps) {
  if (!isOwner) {
    return (
      <div
        id="subscription"
        className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Subscription
        </h2>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-700">
            Current Plan:{' '}
            <span className="font-semibold">
              {org.plan
                ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1)
                : 'No Plan'}
            </span>
          </p>
          <BillingStatus />
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Only the organization owner can change plans or billing.
        </p>
      </div>
    );
  }

  return (
    <div
      id="subscription"
      className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">
        {org.plan ? 'Subscription & billing' : 'Choose a plan'}
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Select <strong className="font-medium text-gray-700">monthly</strong> or{' '}
        <strong className="font-medium text-gray-700">yearly</strong> billing,
        then pick a plan. Checkout opens in Stripe with the price for that
        interval.
      </p>

      {billingNotice ? (
        <p
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            billingNoticeTone === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {billingNotice}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-700">
            Current Plan:{' '}
            <span className="font-semibold">
              {org.plan
                ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1)
                : 'No Plan'}
            </span>
          </p>
          <BillingStatus />
        </div>
        {org.assetLimit !== null && org.assetLimit !== undefined && (
          <p className="text-sm text-gray-500">
            Asset limit: {org.assetLimit}
          </p>
        )}
      </div>

      {org.plan === 'basic' && (
        <p className="mt-3 text-sm text-amber-700">
          Upgrade to Pro for barcode scanning, GPS capture, inspection photos,
          and AI.
        </p>
      )}

      {org.stripeCustomerId ? (
        <div className="mt-4">
          <ManageBilling />
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">
          {org.plan ? 'Change plan' : 'Available plans'}
        </h3>
        <PlanSelector />
      </div>
    </div>
  );
}
