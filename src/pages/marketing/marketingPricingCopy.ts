/**
 * Display-only pricing and FAQ copy for the public marketing site.
 *
 * Prices read from VITE_PRICE_* env vars so they stay in sync with planConfig.
 * Change .env → rebuild → marketing page updates automatically.
 */

import { PLANS, yearlyTotalFromMonthly, YEARLY_DISCOUNT_FRACTION } from '../../lib/planConfig.ts';
import {
  getLaunchPromoFaqItem,
  getLaunchPromoPlanNote,
  TRIAL_DAYS,
} from '../../lib/billingConfig.ts';

function formatPrice(price: number | null): string {
  if (price === null) return 'Custom';
  return price % 1 === 0 ? `$${price}` : `$${price.toFixed(2)}`;
}

const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);

const basicPlan = PLANS.find((p) => p.name === 'basic')!;
const proPlan = PLANS.find((p) => p.name === 'pro')!;
const elitePlan = PLANS.find((p) => p.name === 'elite')!;

export const CONTACT_SALES_EMAIL = 'info@extinguishertracker.com';

export const CONTACT_SALES_MAILTO = `mailto:${CONTACT_SALES_EMAIL}?subject=Extinguisher%20Tracker%20Enterprise`;

export type MarketingPlanId = 'basic' | 'pro' | 'elite' | 'enterprise';

export type MarketingPlanCard = {
  id: MarketingPlanId;
  /** Must match product plan names: Basic, Pro, Elite, Enterprise */
  name: string;
  priceLabel: string;
  priceDetail: string;
  /** Shown under the headline price for paid tiers (yearly prepay). */
  annualBillingNote?: string;
  /** Launch promo footnote (hidden when VITE_LAUNCH_PROMO_ENABLED=false). */
  launchPromoNote?: string;
  blurb: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: 'signup' | 'mailto';
  recommended?: boolean;
};

export const marketingPlans: MarketingPlanCard[] = [
  {
    id: 'basic',
    name: 'Basic',
    priceLabel: formatPrice(basicPlan.monthlyPrice),
    priceDetail: 'per month',
    annualBillingNote: `Or ${formatPrice(yearlyTotalFromMonthly(basicPlan.monthlyPrice!))} per year if prepaid (${Math.round(YEARLY_DISCOUNT_FRACTION * 100)}% off vs 12× monthly).`,
    launchPromoNote: getLaunchPromoPlanNote('basic') ?? undefined,
    blurb: 'Small sites that want to ditch paper, speed up checks, and build a reliable workflow baseline.',
    bullets: [
      'Fast search by barcode',
      'Section auto timer for route pace',
      'Placement & quantity calculator',
      'Easy inspection workflow',
      'Standard reports, exports & history',
    ],
    ctaLabel: 'Get started',
    ctaHref: 'signup',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: formatPrice(proPlan.monthlyPrice),
    priceDetail: 'per month',
    annualBillingNote: `Or ${formatPrice(yearlyTotalFromMonthly(proPlan.monthlyPrice!))} per year if prepaid (${Math.round(YEARLY_DISCOUNT_FRACTION * 100)}% off vs 12× monthly).`,
    launchPromoNote: getLaunchPromoPlanNote('pro') ?? undefined,
    blurb: 'Growing teams that need lightning-fast scanning and in-app AI guidance while work is happening.',
    bullets: [
      '7-day free trial on monthly billing — no credit card at signup (then paid monthly)',
      'Everything in Basic',
      'Fast phone camera scanning',
      'AI Maintenance helper with configurable NFPA reference',
      'GPS & photo proof of work',
      'Custom asset inspections',
      'Organization logo branding',
    ],
    ctaLabel: 'Get started',
    ctaHref: 'signup',
    recommended: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    priceLabel: formatPrice(elitePlan.monthlyPrice),
    priceDetail: 'per month',
    annualBillingNote: `Or ${formatPrice(yearlyTotalFromMonthly(elitePlan.monthlyPrice!))} per year if prepaid (${Math.round(YEARLY_DISCOUNT_FRACTION * 100)}% off vs 12× monthly).`,
    launchPromoNote: getLaunchPromoPlanNote('elite') ?? undefined,
    blurb: 'Large programs that need advanced data tools, AI-supported operations, and priority help.',
    bullets: [
      'Everything in Pro',
      'Team member invites and role management',
      'Advanced data cleanup tools',
      'Bulk tag printing',
      'Guest sharing for outside reviewers',
      'Priority help from our team',
    ],
    ctaLabel: 'Get started',
    ctaHref: 'signup',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    priceDetail: 'volume, security, and procurement',
    blurb:
      'For the biggest portfolios with full support, custom setup, and edition-aware compliance operations.',
    bullets: [
      'Everything in Elite',
      'Full AI, timer insights, audit history, and data recovery',
      'Dedicated setup and help',
      'Unlimited extinguishers',
    ],
    ctaLabel: 'Contact sales',
    ctaHref: 'mailto',
  },
];

export type MarketingFaqItem = { q: string; a: string };

const BASE_MARKETING_FAQ: MarketingFaqItem[] = [
  {
    q: 'Does this replace our paper binders or spreadsheets?',
    a: 'It gives you a single system of record for extinguishers, inspections, and history. Teams still follow your internal procedures; the software organizes the work and the evidence.',
  },
  {
    q: 'What does the product track besides monthly extinguisher checks?',
    a: 'ExtinguisherTracker also supports locations, tags, QR links, photos, GPS context, lifecycle replacement and retirement history, returned spare inventory, custom asset inspections, notifications, reports, exports, and audit logs depending on plan access.',
  },
  {
    q: 'Can AI answer NFPA questions while my team is working?',
    a: 'Yes. Pro, Elite, and Enterprise include in-app AI assistance for maintenance and compliance questions so teams do not need to leave the workflow. When AI lists extinguishers, it includes finder details such as asset number, serial number, location, section, and vicinity when available. AI guidance uses the NFPA reference configured in Settings; new organizations fall back to NFPA 10 (2022), and your organization should align final decisions to its locally adopted edition.',
  },
  {
    q: 'Does the calculator guarantee code compliance?',
    a: 'No. The calculator is a planning aid that helps with NFPA-aligned coverage thinking. Final placement and compliance decisions should be confirmed against local requirements, your adopted code edition, and AHJ direction.',
  },
  {
    q: 'Can the app work in low-connectivity areas?',
    a: 'The app includes offline-oriented field support and a sync queue so crews can keep working when signal is unreliable. Teams should still confirm pending work has synced before relying on final records.',
  },
  {
    q: 'Can outside reviewers see records without becoming full users?',
    a: 'Guest access is designed for limited visibility when an auditor, partner, or temporary reviewer needs to see shared information without receiving full administrative access.',
  },
  {
    q: 'Who is the typical buyer?',
    a: 'Safety managers, maintenance leads, facility directors, and property operators who are responsible for inspection evidence and recurring compliance work.',
  },
  {
    q: 'Can we try it before committing?',
    a: `Yes. Every new subscription includes a ${TRIAL_DAYS}-day free trial with full plan access. Add a payment method at checkout; you will not be charged until the trial ends. Cancel anytime from billing settings.`,
  },
  {
    q: 'What about Enterprise pricing?',
    a: 'Enterprise is tailored to contract terms, seat counts, and rollout needs. Use Contact sales and we will align with your procurement process.',
  },
  {
    q: 'Is there a discount for paying annually?',
    a: 'Yes. When you choose yearly billing in the app, you prepay for 12 months at 10% less than twelve separate monthly payments. The exact total matches the yearly option at checkout.',
  },
];

/** FAQ list — launch promo item appended only when VITE_LAUNCH_PROMO_ENABLED=true. */
export function getMarketingFaq(): MarketingFaqItem[] {
  const launchFaq = getLaunchPromoFaqItem();
  if (!launchFaq) return BASE_MARKETING_FAQ;
  const trialIdx = BASE_MARKETING_FAQ.findIndex((item) => item.q.includes('try it'));
  if (trialIdx === -1) return [...BASE_MARKETING_FAQ, launchFaq];
  return [
    ...BASE_MARKETING_FAQ.slice(0, trialIdx + 1),
    launchFaq,
    ...BASE_MARKETING_FAQ.slice(trialIdx + 1),
  ];
}

/** @deprecated use getMarketingFaq() */
export const marketingFaq = BASE_MARKETING_FAQ;
