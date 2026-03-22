import { Link } from 'react-router-dom';
import { Check, Tag } from 'lucide-react';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import {
  CONTACT_SALES_MAILTO,
  MARKETING_LAUNCH_OFFER,
  marketingFaq,
  marketingPlans,
} from './marketingPricingCopy.ts';
import { marketingSeo } from './marketingSeo.ts';

export default function MarketingPricingPage() {
  const seo = marketingSeo.pricing;

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Pricing</h1>
            <p className="mt-4 max-w-3xl text-lg text-gray-600">
              Compare <strong>Basic</strong>, <strong>Pro</strong>, <strong>Elite</strong>, and{' '}
              <strong>Enterprise</strong>. Dollar amounts on this page are for orientation only; subscription and
              entitlements are enforced in the product billing experience.
            </p>
            <div className="mt-8 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
              <div className="flex gap-3">
                <Tag className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                <div>
                  <p className="font-semibold text-amber-950">{MARKETING_LAUNCH_OFFER.headline}</p>
                  <p className="mt-1 text-sm text-amber-950/90">{MARKETING_LAUNCH_OFFER.body}</p>
                  <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-amber-950">
                    {MARKETING_LAUNCH_OFFER.codes.map(({ plan, code }) => (
                      <li key={code}>
                        <span className="text-amber-800/80">{plan}:</span>{' '}
                        <code className="rounded bg-white/80 px-1.5 py-0.5 text-amber-950">{code}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-6 lg:grid-cols-4">
            {marketingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  plan.recommended ? 'border-red-300 ring-2 ring-red-100 lg:scale-[1.02]' : 'border-gray-200'
                }`}
              >
                {plan.recommended ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Recommended</p>
                ) : null}
                <h2 className="mt-1 text-xl font-bold text-gray-900">{plan.name}</h2>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-gray-900">{plan.priceLabel}</span>
                  {plan.priceDetail ? (
                    <span className="text-sm text-gray-500"> {plan.priceDetail}</span>
                  ) : null}
                </p>
                <p className="mt-3 text-sm text-gray-600">{plan.blurb}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-700">
                  {plan.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                {plan.ctaHref === 'mailto' ? (
                  <a
                    href={CONTACT_SALES_MAILTO}
                    className="mt-8 block w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                  >
                    {plan.ctaLabel}
                  </a>
                ) : (
                  <Link
                    to="/signup"
                    className={`mt-8 block w-full rounded-md px-4 py-2.5 text-center text-sm font-semibold text-white shadow ${
                      plan.recommended
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-900 hover:bg-gray-800'
                    }`}
                  >
                    {plan.ctaLabel}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-gray-500">
            Questions about Enterprise or procurement? Use Contact sales on the Enterprise plan.
          </p>
        </div>

        <div className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-2xl font-bold text-gray-900">FAQ</h2>
            <dl className="mt-8 space-y-8">
              {marketingFaq.map((item) => (
                <div key={item.q}>
                  <dt className="text-base font-semibold text-gray-900">{item.q}</dt>
                  <dd className="mt-2 text-sm text-gray-600">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
            <Link to="/features" className="font-medium text-red-600 hover:text-red-500">
              Review features in detail →
            </Link>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
