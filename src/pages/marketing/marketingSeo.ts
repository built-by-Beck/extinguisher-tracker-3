/** SEO strings for public marketing pages (edit freely). */
import { TRIAL_DAYS } from '../../lib/billingConfig.ts';

export const marketingSeo = {
  home: {
    title:
      'ExtinguisherTracker — AI fire extinguisher inspections & compliance',
    description:
      `Start a ${TRIAL_DAYS}-day free trial, save 10% on yearly billing, or use launch codes EX3PRO50 for 50% off year one. Field-built extinguisher inventory, AI inspections, offline sync, reports, and compliance tracking.`,
    path: '/',
  },
  features: {
    title: 'Features — ExtinguisherTracker',
    description:
      'AI maintenance assistant, timed routes, inventory, barcode and QR lookup, offline sync, photo evidence, custom asset inspections, guest access, audit logs, and exports.',
    path: '/features',
  },
  pricing: {
    title: 'Pricing — ExtinguisherTracker',
    description:
      `Basic, Pro, Elite, and Enterprise plans. ${TRIAL_DAYS}-day free trial, 10% off yearly prepay, and limited launch promo: EX3BASIC50 / EX3PRO50 / EX3ELITE50 for 50% off year one.`,
    path: '/pricing',
  },
  howItWorks: {
    title: 'How it works — ExtinguisherTracker',
    description:
      'From organization setup to AI-assisted inspections, offline field work, reminders, issue tracking, reporting, sharing, and audit-ready records.',
    path: '/how-it-works',
  },
  about: {
    title: 'About — ExtinguisherTracker',
    description:
      'Learn how ExtinguisherTracker was independently built from field-level life safety experience and practical software development.',
    path: '/about',
  },
  gettingStarted: {
    title: 'Getting Started — ExtinguisherTracker',
    description:
      'Step-by-step onboarding from account setup to inventory, inspections, evidence capture, reports, sharing, AI-assisted guidance, and workflow best practices.',
    path: '/getting-started',
  },
  faq: {
    title: 'FAQ — ExtinguisherTracker',
    description:
      'Frequently asked questions about setup, pricing, AI assistance, NFPA edition references, and daily inspection operations.',
    path: '/faq',
  },
  terms: {
    title: 'Terms of Service — ExtinguisherTracker',
    description:
      'Terms of Service for the ExtinguisherTracker platform. Read our usage terms, billing policies, and legal guidelines.',
    path: '/terms',
  },
  privacy: {
    title: 'Privacy Policy — ExtinguisherTracker',
    description:
      'Privacy Policy for ExtinguisherTracker.com. How we collect, use, store, and protect your account, inspection, and payment information.',
    path: '/privacy-policy',
  },
} as const;
