/**
 * Display-only pricing and FAQ copy for the public marketing site.
 * Does not drive billing; update amounts and bullets as your go-to-market evolves.
 */

export const CONTACT_SALES_EMAIL = 'sales@example.com';

export const CONTACT_SALES_MAILTO = `mailto:${CONTACT_SALES_EMAIL}?subject=Extinguisher%20Tracker%20Enterprise`;

/** Shown on the public pricing page — codes must exist as Stripe Promotion codes linked to launch coupons. */
export const MARKETING_LAUNCH_OFFER = {
  headline: 'Launch offer: 50% off your first year',
  body:
    'For a limited time, new Basic, Pro, and Elite subscriptions are eligible for 50% off for the first 12 billing months. Enter the promotion code that matches your plan on the Stripe checkout page (promo field).',
  codes: [
    { plan: 'Basic', code: 'EX3BASIC50' },
    { plan: 'Pro', code: 'EX3PRO50' },
    { plan: 'Elite', code: 'EX3ELITE50' },
  ] as const,
};

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
    priceLabel: '$29.99',
    priceDetail: 'per month',
    blurb: 'Smaller sites getting consistent records and inspections in one place.',
    bullets: [
      'Core inventory and location structure',
      'Inspection workflows for your team',
      'Standard reporting and history',
    ],
    ctaLabel: 'Get started',
    ctaHref: 'signup',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$99',
    priceDetail: 'per month',
    blurb: 'Growing organizations that need more throughput and operational visibility.',
    bullets: [
      'Everything in Basic',
      'Deeper workflows for larger footprints',
      'Stronger reporting and team coordination',
    ],
    ctaLabel: 'Get started',
    ctaHref: 'signup',
    recommended: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    priceLabel: '$199',
    priceDetail: 'per month',
    blurb: 'Multi-site and high-accountability programs that live in audits and inspections.',
    bullets: [
      'Everything in Pro',
      'Scaled operations across buildings and regions',
      'Priority-style positioning for demanding programs',
    ],
    ctaLabel: 'Get started',
    ctaHref: 'signup',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    priceDetail: 'volume, security, and procurement',
    blurb: 'Dedicated onboarding, custom terms, and alignment with your IT and safety programs.',
    bullets: [
      'Custom contract and billing alignment',
      'Rollout support for large portfolios',
      'Talk with us about security and compliance expectations',
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
  {
    q: 'How does the launch / first-year discount work?',
    a: 'When you subscribe to Basic, Pro, or Elite, enter the matching promotion code on the Stripe checkout page. The discount applies to the first 12 subscription invoices (your first year on a monthly plan). Codes and eligibility can change; if a code does not apply, contact support.',
  },
];
