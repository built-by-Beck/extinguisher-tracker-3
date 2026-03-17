import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Check, Loader2 } from 'lucide-react';
import { functions } from '../../lib/firebase.ts';
import { PLANS, type PlanName } from '../../lib/planConfig.ts';
import { useOrg } from '../../hooks/useOrg.ts';
import { useAuth } from '../../hooks/useAuth.ts';

export function PlanSelector() {
  const { org } = useOrg();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState<PlanName | null>(null);
  const [error, setError] = useState('');

  const orgId = userProfile?.activeOrgId;
  const currentPlan = org?.plan;

  async function handleSelectPlan(plan: PlanName) {
    if (!orgId || plan === currentPlan) return;
    setLoading(plan);
    setError('');

    try {
      const createCheckoutSession = httpsCallable<
        { orgId: string; plan: string },
        { url: string }
      >(functions, 'createCheckoutSession');

      const result = await createCheckoutSession({ orgId, plan });
      if (result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout.';
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.filter((p) => p.name !== 'enterprise').map((plan) => {
          const isCurrent = currentPlan === plan.name;
          const isLoading = loading === plan.name;

          return (
            <div
              key={plan.name}
              className={`rounded-lg border-2 p-6 ${
                isCurrent
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <h3 className="text-lg font-bold text-gray-900">{plan.displayName}</h3>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                ${plan.monthlyPrice}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>

              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.name)}
                disabled={isCurrent || isLoading || loading !== null}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'bg-red-100 text-red-700 cursor-default'
                    : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  'Current Plan'
                ) : currentPlan ? (
                  'Switch Plan'
                ) : (
                  'Get Started'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Enterprise CTA */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">
          Need more than 500 extinguishers?{' '}
          <span className="font-semibold text-gray-900">Enterprise</span> plans with unlimited
          assets and custom pricing are available.
        </p>
        <p className="mt-1 text-sm text-gray-500">Contact us at support@ex3app.com</p>
      </div>
    </div>
  );
}
