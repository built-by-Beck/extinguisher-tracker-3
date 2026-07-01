import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Bot,
  Barcode,
  Camera,
  Clock3,
  ClipboardCheck,
  DatabaseZap,
  FileDown,
  Printer,
  Share2,
  Users,
  Calculator,
} from 'lucide-react';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { BillingIntervalToggle } from '../../components/billing/BillingIntervalToggle.tsx';
import { MarketingSignupLink } from '../../components/marketing/MarketingSignupLink.tsx';
import { useBillingIntervalPreference } from '../../hooks/useBillingIntervalPreference.ts';
import { PLAN_CTA_LABEL, TRIAL_CTA_LABEL } from '../../lib/marketingCtaCopy.ts';
import { PLANS } from '../../lib/planConfig.ts';
import { marketingPriceForInterval } from '../../lib/marketingPlanPricing.ts';
import { PlanHeadlinePrice } from '../../components/billing/PlanHeadlinePrice.tsx';
import {
  CONTACT_SALES_MAILTO,
  marketingPlans,
  type MarketingPlanId,
} from './marketingPricingCopy.ts';

const VALID_IDS = new Set<string>(['basic', 'pro', 'elite', 'enterprise']);

type PlanHighlight = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const highlights: Record<MarketingPlanId, PlanHighlight[]> = {
  basic: [
    {
      icon: Barcode,
      title: 'Fast barcode search',
      body: 'Scan or type a barcode to land on the right extinguisher instantly — no scrolling long lists in the field.',
    },
    {
      icon: Clock3,
      title: 'Section auto timer',
      body: 'Automatic per-section timing tracks how long each route segment takes so you can plan staffing and spot slow sections.',
    },
    {
      icon: Calculator,
      title: 'Placement calculator',
      body: 'Use the advisory NFPA-aligned calculator to plan extinguisher quantities and coverage — always confirm with local AHJ.',
    },
    {
      icon: ClipboardCheck,
      title: 'Standard inspection workflow',
      body: 'Monthly workspaces, structured passes and fails, follow-up tracking, and a durable inspection record your team can rely on.',
    },
    {
      icon: FileDown,
      title: 'Reports, exports & history',
      body: 'Generate PDF, CSV, and JSON reports with asset, serial, location, section, and vicinity details for audits and leadership review.',
    },
  ],
  pro: [
    {
      icon: Bot,
      title: 'AI Maintenance Assistant',
      body: 'Ask compliance questions, get live overdue summaries, draft inspection notes from rough descriptions, and analyze temporary photos — all in-app without stopping the route.',
    },
    {
      icon: Barcode,
      title: 'Phone camera scanning',
      body: 'Scan barcodes live with your phone camera for faster, more accurate field lookup compared to manual search.',
    },
    {
      icon: Camera,
      title: 'GPS & photo proof of work',
      body: 'Attach location context and photos to inspections so records show the full story — not just a pass/fail checkbox.',
    },
    {
      icon: ClipboardCheck,
      title: 'Custom asset inspections',
      body: 'Build recurring inspection programs for other life safety assets beyond extinguishers — same workflow, tracked separately.',
    },
    {
      icon: Users,
      title: 'Organization logo branding',
      body: 'Add your logo to create a more polished, branded workspace for your team.',
    },
  ],
  elite: [
    {
      icon: Users,
      title: 'Team member invites & roles',
      body: 'Invite inspectors, admins, and viewers to collaborate on inspection work with role-controlled access — owner, admin, inspector, and viewer roles keep permissions clear.',
    },
    {
      icon: DatabaseZap,
      title: 'Advanced data cleanup tools',
      body: 'Detect and merge duplicate records, and restore full organization data from JSON backup files when you need to recover or migrate.',
    },
    {
      icon: Printer,
      title: 'Bulk tag printing',
      body: 'Print tags at scale for larger programs instead of one unit at a time — speeds up label workflows across big portfolios.',
    },
    {
      icon: Share2,
      title: 'Guest sharing for outside reviewers',
      body: 'Share limited read-only access with auditors, partners, or temporary reviewers without granting full account access.',
    },
    {
      icon: FileDown,
      title: 'Priority help from our team',
      body: 'Get faster responses and dedicated support when questions or issues come up — you are not waiting in a general queue.',
    },
  ],
  enterprise: [
    {
      icon: Users,
      title: 'Custom contract terms',
      body: "Volume pricing, procurement alignment, and billing terms structured to fit your organization's requirements and approval process.",
    },
    {
      icon: DatabaseZap,
      title: 'Dedicated setup and onboarding',
      body: 'Hands-on help during rollout and ongoing dedicated support from our team for the life of the contract.',
    },
    {
      icon: Barcode,
      title: 'Unlimited extinguishers',
      body: 'No inventory caps — scale to as many units as your portfolio requires without hitting a ceiling.',
    },
    {
      icon: Bot,
      title: 'Full AI, timer insights & data recovery',
      body: 'Complete access to all AI capabilities, section timer insights, full audit history depth, and data recovery tools across the platform.',
    },
  ],
};

const forWho: Record<MarketingPlanId, string> = {
  basic:
    'Small facilities and single-building operations moving off paper and spreadsheets. Good for a lean team that needs reliable inventory, structured inspection records, and reports without extra complexity.',
  pro: 'Growing teams that need live AI guidance in the field, faster scanning, photo documentation, and custom inspection workflows for assets beyond extinguishers.',
  elite:
    'Larger programs managing multiple team members, big tag label operations, guest reviewer access, and datasets that need active cleanup and backup tools.',
  enterprise:
    'The largest portfolios with procurement requirements, custom rollout needs, dedicated support expectations, and compliance operations that span many facilities.',
};

const includesNote: Record<MarketingPlanId, string | null> = {
  basic: null,
  pro: 'Includes everything in Basic.',
  elite: 'Includes everything in Pro (and Basic).',
  enterprise: 'Includes everything in Elite, Pro, and Basic.',
};

export default function MarketingPlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const { interval, setInterval } = useBillingIntervalPreference();

  if (!planId || !VALID_IDS.has(planId)) {
    return <Navigate to="/pricing" replace />;
  }

  const id = planId as MarketingPlanId;
  const plan = marketingPlans.find((p) => p.id === id);
  if (!plan) return <Navigate to="/pricing" replace />;

  const planConfig = PLANS.find((p) => p.name === id);
  const priceDisplay =
    planConfig?.monthlyPrice != null
      ? marketingPriceForInterval(planConfig.monthlyPrice, interval)
      : {
          priceLabel: plan.priceLabel,
          priceDetail: plan.priceDetail,
          regularPriceLabel: plan.regularPriceLabel,
        };

  const planHighlights = highlights[id];
  const forWhoText = forWho[id];
  const includes = includesNote[id];

  return (
    <>
      <MarketingPageMeta
        title={`${plan.name} Plan — ExtinguisherTracker`}
        description={plan.blurb}
        path={`/plans/${id}`}
      />
      <PublicMarketingLayout>
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-500"
            >
              <ArrowLeft className="h-4 w-4" />
              All plans
            </Link>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                {plan.recommended && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Recommended
                  </p>
                )}
                <h1 className="mt-1 text-4xl font-bold tracking-tight text-gray-900">
                  {plan.name}
                </h1>
                <p className="mt-3 text-lg text-gray-600">{plan.blurb}</p>
              </div>
              <div className="shrink-0 sm:text-right">
                <PlanHeadlinePrice
                  price={priceDisplay}
                  className="sm:items-end"
                />
                {priceDisplay.footnote ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {priceDisplay.footnote}
                  </p>
                ) : null}
                {id === 'pro' && interval === 'year' ? (
                  <p className="mt-2 text-xs text-blue-800">
                    Switch to monthly above for the 7-day Pro trial.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <BillingIntervalToggle
                value={interval}
                onChange={setInterval}
                prominent
              />
            </div>

            <div className="mt-6">
              {plan.ctaHref === 'mailto' ? (
                <a
                  href={CONTACT_SALES_MAILTO}
                  className="inline-flex rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                >
                  Contact sales
                </a>
              ) : (
                <MarketingSignupLink
                  interval={interval}
                  planId={id}
                  proTrial={id === 'pro' && interval === 'month'}
                  className="inline-flex rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700"
                >
                  {id === 'pro' && interval === 'month'
                    ? TRIAL_CTA_LABEL
                    : `${PLAN_CTA_LABEL} with ${plan.name}`}
                </MarketingSignupLink>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl space-y-14 px-4 py-14 sm:px-6 sm:py-16">
          {/* What's included bullets */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              What's included
            </h2>
            {includes && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {includes}
              </p>
            )}
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {plan.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                    aria-hidden
                  />
                  <span className="text-sm text-gray-800">{b}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Feature highlights */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900">Key features</h2>
            <p className="mt-2 text-sm text-gray-600">
              A closer look at what you'll use most on the {plan.name} plan.
            </p>
            <div className="mt-6 space-y-4">
              {planHighlights.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50">
                    <Icon className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Who it's for */}
          <section className="rounded-xl border border-blue-100 bg-blue-50 p-6">
            <h2 className="text-lg font-semibold text-blue-900">
              Who {plan.name} is for
            </h2>
            <p className="mt-2 text-sm text-blue-800">{forWhoText}</p>
          </section>

          {/* Compare / CTA */}
          <section className="rounded-2xl bg-gray-900 px-6 py-10 text-center">
            <h2 className="text-2xl font-bold text-white">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-gray-300">
              Create your account and set up your organization in minutes.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {plan.ctaHref === 'mailto' ? (
                <a
                  href={CONTACT_SALES_MAILTO}
                  className="inline-flex rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700"
                >
                  Contact sales
                </a>
              ) : (
                <MarketingSignupLink
                  interval={interval}
                  planId={id}
                  proTrial={id === 'pro' && interval === 'month'}
                  className="inline-flex rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700"
                >
                  {id === 'pro' && interval === 'month'
                    ? TRIAL_CTA_LABEL
                    : `${PLAN_CTA_LABEL} with ${plan.name}`}
                </MarketingSignupLink>
              )}
              <Link
                to="/pricing"
                className="inline-flex rounded-md border border-gray-500 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Compare all plans
              </Link>
            </div>
          </section>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
