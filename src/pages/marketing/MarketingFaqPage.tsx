import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { marketingSeo } from './marketingSeo.ts';
import { marketingFaq } from './marketingPricingCopy.ts';

const extraFaq = [
  {
    q: 'How quickly can we get started?',
    a: 'Most teams can set up locations, import inventory, and start first inspections the same day.',
  },
  {
    q: 'Can AI help while technicians are in the field?',
    a: 'Yes. AI can provide quick guidance on maintenance and compliance questions without leaving the app workflow. It is support for trained decision-making, not a replacement for local code review or qualified judgment.',
  },
  {
    q: 'What NFPA edition does AI reference?',
    a: 'AI references the NFPA edition configured in Organization Settings. New organizations fall back to NFPA 10 (2022) until changed; final decisions should still be validated against the locally adopted edition, internal policy, and AHJ direction.',
  },
  {
    q: 'Do we need perfect data before starting?',
    a: 'No. Import what you have, then use Data Organizer to close gaps over time.',
  },
  {
    q: 'Can we track more than extinguishers?',
    a: 'Yes. Custom asset inspections let teams build recurring inspection workflows for other assets that need structured checks, notes, and follow-up visibility.',
  },
  {
    q: 'Can we add profile pictures or organization branding?',
    a: 'User profiles use preset avatars instead of personal photo uploads. Organization creators can add a small logo on Pro, Elite, and Enterprise plans, with image type, size, permission, and Storage path restrictions.',
  },
  {
    q: 'What happens when an extinguisher is replaced or retired?',
    a: 'The replacement flow confirms the old unit, archives its prior serial/barcode/unit details, updates the active record with the current unit, and provides a Replaced Extinguishers view for retired-unit status. If an old unit returns from service, owners/admins can add it back as active spare inventory with a new spare asset ID.',
  },
  {
    q: 'Can we print tags or work from QR codes?',
    a: 'Yes. The product supports QR-oriented workflows, printable inventory lists, and tag printing so the digital record connects back to the physical extinguisher.',
  },
  {
    q: 'How do reminders, notifications, and audit logs fit together?',
    a: 'Notifications help surface due or overdue work, reports summarize program status, and audit logs preserve important activity for later review.',
  },
] as const;

export default function MarketingFaqPage() {
  const seo = marketingSeo.faq;
  const allFaq = [...marketingFaq, ...extraFaq];

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-7 w-7 text-red-600" />
              <h1 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Answers about onboarding, pricing, AI support, and compliance workflow.
            </p>
          </div>

          <dl className="mt-6 space-y-4">
            {allFaq.map((item) => (
              <div key={item.q} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <dt className="text-base font-semibold text-gray-900">{item.q}</dt>
                <dd className="mt-2 text-sm text-gray-600">{item.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 rounded-2xl bg-red-600 px-6 py-10 text-center">
            <h2 className="text-2xl font-bold text-white">Need the full onboarding flow?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-red-100">
              Use our Getting Started page for the end-to-end setup path from signup to completed inspections.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/getting-started"
                className="inline-flex rounded-md bg-white px-6 py-3 text-sm font-semibold text-red-700 shadow hover:bg-red-50"
              >
                Open Getting Started
              </Link>
              <Link
                to="/signup"
                className="inline-flex rounded-md border border-red-300 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
