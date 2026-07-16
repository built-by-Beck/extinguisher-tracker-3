import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { getMarketingFaq } from './marketingPricingCopy.ts';
import { LAUNCH_PROMO, LAUNCH_PROMO_ENABLED } from '../../lib/billingConfig.ts';
import { LimitedTimeOfferBanner } from '../../components/marketing/LimitedTimeOfferBanner.tsx';
import { marketingSeo } from './marketingSeo.ts';
import { Link } from 'react-router-dom';
import { MarketingPricingPlans } from '../../components/marketing/MarketingPricingPlans.tsx';

export default function MarketingPricingPage() {
  const seo = marketingSeo.pricing;

  return (
    <>
      <MarketingPageMeta
        title={seo.title}
        description={seo.description}
        path={seo.path}
      />
      <PublicMarketingLayout>
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Pricing
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-gray-600">
              {LAUNCH_PROMO_ENABLED ? (
                <>
                  Lock in <strong>{LAUNCH_PROMO.headline}</strong> on Basic,
                  Pro, or Elite — then compare features. Every paid plan also
                  includes a free trial before your first charge.
                </>
              ) : (
                <>
                  Compare <strong>Basic</strong>, <strong>Pro</strong>,{' '}
                  <strong>Elite</strong>, and <strong>Enterprise</strong>. Every
                  paid plan includes a free trial and annual prepay savings.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="border-b border-gray-200 bg-gray-100 px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-6xl space-y-6">
            <LimitedTimeOfferBanner variant="inline" />
          </div>
        </div>

        <MarketingPricingPlans compactToggle />

        <div className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-2xl font-bold text-gray-900">FAQ</h2>
            <dl className="mt-8 space-y-8">
              {getMarketingFaq().map((item) => (
                <div key={item.q}>
                  <dt className="text-base font-semibold text-gray-900">
                    {item.q}
                  </dt>
                  <dd className="mt-2 text-sm text-gray-600">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
            <Link
              to="/features"
              className="font-medium text-red-600 hover:text-red-500"
            >
              Review features in detail →
            </Link>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
