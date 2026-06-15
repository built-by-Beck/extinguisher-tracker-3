import { YEARLY_DISCOUNT_FRACTION } from '../../lib/planConfig.ts';

export type BillingIntervalUi = 'month' | 'year';

type BillingIntervalToggleProps = {
  value: BillingIntervalUi;
  onChange: (interval: BillingIntervalUi) => void;
  /** Larger layout for the subscription checkout section */
  prominent?: boolean;
};

export function BillingIntervalToggle({
  value,
  onChange,
  prominent = false,
}: BillingIntervalToggleProps) {
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);

  return (
    <div
      className={
        prominent
          ? 'rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5'
          : undefined
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className={
              prominent
                ? 'text-base font-semibold text-gray-900'
                : 'text-sm font-medium text-gray-900'
            }
          >
            Billing frequency
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Choose monthly or yearly before you select a plan. Yearly prepay saves{' '}
            {discountPct}%.
          </p>
          {value === 'year' && (
            <p className="mt-1 text-xs font-medium text-green-700">
              Annual billing selected — charged once per year at checkout.
            </p>
          )}
          {value === 'month' && (
            <p className="mt-1 text-xs text-gray-600">
              Monthly billing — eligible orgs can start a 7-day Pro trial with no
              card at checkout.
            </p>
          )}
        </div>
        <div
          className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
          role="group"
          aria-label="Billing frequency"
        >
          <button
            type="button"
            onClick={() => onChange('month')}
            aria-pressed={value === 'month'}
            className={`rounded-md px-5 py-2.5 text-sm font-semibold transition-colors ${
              value === 'month'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => onChange('year')}
            aria-pressed={value === 'year'}
            className={`rounded-md px-5 py-2.5 text-sm font-semibold transition-colors ${
              value === 'year'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Yearly
            <span
              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                value === 'year'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              SAVE {discountPct}%
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
