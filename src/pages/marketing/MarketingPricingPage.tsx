import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { MarketingPricingPlans } from '../../components/marketing/MarketingPricingPlans.tsx';
import { marketingFaq } from './marketingPricingCopy.ts';
import { marketingSeo } from './marketingSeo.ts';
import { Link } from 'react-router-dom';

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
        <MarketingPricingPlans showIntro />

        <p className="mx-auto max-w-6xl px-4 pb-6 text-center text-sm text-gray-500 sm:px-6">
          Questions about Enterprise or procurement? Use Contact sales on the
          Enterprise plan.
        </p>

        <div className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-2xl font-bold text-gray-900">FAQ</h2>
            <dl className="mt-8 space-y-8">
              {marketingFaq.map((item) => (
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
