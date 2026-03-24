/**
 * Display-only pricing and FAQ copy for the public marketing site.
 *
 * Prices read from VITE_PRICE_* env vars so they stay in sync with planConfig.
 * Change .env → rebuild → marketing page updates automatically.
 */

import { PLANS } from '../../lib/planConfig.ts';

function formatPrice(price: number | null): string {
  if (price === null) return 'Custom';
  return price % 1 === 0 ? `$${price}` : `$${price}`;
}

const basicPlan = PLANS.find((p) => p.name === 'basic')!;
const proPlan = PLANS.find((p) => p.name === 'pro')!;
const elitePlan = PLANS.find((p) => p.name === 'elite')!;

export const CONTACT_SALES_EMAIL = 'sales@example.com';

export const CONTACT_SALES_MAILTO = `mailto:${CONTACT_SALES_EMAIL}?subject=Extinguisher%20Tracker%20Enterprise`;

export type MarketingPlanId = 'basic' | 'pro' | 'elite' | 'enterprise';

export type MarketingPlanCard = {
  id: MarketingPlanId;
  /** Must match product plan names: Basic, Pro, Elite, Enterprise */
  name: string;
  priceLabel: string;
  priceDetail: string;
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
    blurb: 'Small sites that want to ditch paper and get faster checks.',
    bullets: [
      'Fast search by barcode',
      'Placement & quantity calculator',
      'Easy inspection workflow',
      'Standard reports & history',
    ],
    ctaLabel: 'Get started',
    ctaHref: 'signup',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: formatPrice(proPlan.monthlyPrice),
    priceDetail: 'per month',
    blurb: 'Growing teams that need lightning fast scanning and AI help.',
    bullets: [
      'Everything in Basic',
      'Fast phone camera scanning',
      'AI Maintenance helper',
      'GPS & photo proof of work',
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
    blurb: 'Large programs that need advanced data tools and priority help.',
    bullets: [
      'Everything in Pro',
      'Advanced data cleanup tools',
      'Bulk tag printing',
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
    blurb: 'For the biggest portfolios with full support and custom setup.',
    bullets: [
      'Everything in Elite',
      'Full AI & data recovery',
      'Dedicated setup and help',
      'Unlimited extinguishers',
    ],
    ctaLabel: 'Contact sales',
    ctaHref: 'mailto',
  },
];

export type MarketingFaqItem = { q: string; a: string };

export const marketingFaq: MarketingFaqItem[] = [
  {
    q: 'Does this replace our paper binders or spreadsheets?',
    a: 'It gives you a single system of record for extinguishers, inspections, and history. Teams still follow your internal procedures; the software organizes the work and the evidence.',
  },
  {
    q: 'Who is the typical buyer?',
    a: 'Safety managers, maintenance leads, facility directors, and property operators who are responsible for inspection evidence and recurring compliance work.',
  },
  {
    q: 'Can we try it before committing?',
    a: 'You can create an account and explore the product flow. Subscription and trial behavior follow what you configure in billing; this page is display-only.',
  },
  {
    q: 'What about Enterprise pricing?',
    a: 'Enterprise is tailored to contract terms, seat counts, and rollout needs. Use Contact sales and we will align with your procurement process.',
  },
];
