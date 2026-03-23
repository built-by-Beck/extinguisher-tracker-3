import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Church,
  Factory,
  HeartPulse,
  MapPin,
  School,
  ShieldCheck,
  Wrench,
  Bot,
  Calculator,
  DatabaseZap,
  Barcode,
} from 'lucide-react';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { marketingSeo } from './marketingSeo.ts';

function Section({
  id,
  className = '',
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-4 py-16 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}

export default function MarketingHomePage() {
  const seo = marketingSeo.home;

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        <Section className="py-14 sm:py-20">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Fire extinguisher software built for real maintenance teams
            </h1>
            <p className="mt-5 text-lg text-gray-600 sm:text-xl">
              Extinguisher Tracker helps your team keep inventory accurate, run inspections faster with barcode scanning, and
              keep the records you need for safety and compliance—without the mess of spreadsheets.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/signup"
                className="inline-flex justify-center rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Create account
              </Link>
              <Link
                to="/pricing"
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                View pricing
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Already using the product?{' '}
              <Link to="/login" className="font-medium text-red-600 hover:text-red-500">
                Sign in
              </Link>
            </p>
          </div>
        </Section>

        <div className="border-y border-gray-200 bg-white">
          <Section>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">The problem with paper and spreadsheets</h2>
            <p className="mt-4 max-w-3xl text-gray-600">
              Extinguisher programs create a lot of data: dates, locations, and pass/fail results. When this lives in paper binders or 
              disconnected spreadsheets, it is easy to miss a unit, lose history when staff changes, or scramble when 
              an inspector asks for proof.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                'Hard to see what is due, what failed, and what is still open',
                'Lost data: tags, locations, and units get out of sync',
                'Weak audit trail when fire marshals or inspectors ask for records',
                'Crews need a workflow that works on phones, not just clipboards',
              ].map((item) => (
                <li key={item} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
                  <span className="text-sm text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <Section>
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">What Extinguisher Tracker does</h2>
          <p className="mt-4 max-w-3xl text-gray-600">
            We built a system that matches how you work: easy inventory, fast phone-based inspections, and clear reporting 
            for fire marshals and safety leads. No more surprises during survey season.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Barcode & QR Scanning',
                body: 'Use your phone camera to scan assets instantly. Finish your routes in half the time compared to paper.',
                icon: Barcode,
              },
              {
                title: 'AI Maintenance Helper',
                body: 'Get instant answers to NFPA 10 rules and maintenance questions from our built-in assistant.',
                icon: Bot,
              },
              {
                title: 'Placement Calculator',
                body: 'Not sure how many units you need? Use our calculator to ensure your facility meets coverage rules.',
                icon: Calculator,
              },
              {
                title: 'Simple Inventory',
                body: 'Track every extinguisher with its exact location so your team always knows where to go.',
                icon: MapPin,
              },
              {
                title: 'Inspection Workflow',
                body: 'Standardized checks ensure every unit is inspected the right way, every single time.',
                icon: ClipboardList,
              },
              {
                title: 'Compliance at a Glance',
                body: 'See exactly what is due or overdue on one dashboard. Know your status before an audit happens.',
                icon: ShieldCheck,
              },
              {
                title: 'Data Cleanup Tools',
                body: 'Keep your records clean with automatic duplicate detection and easy backup restoration.',
                icon: DatabaseZap,
              },
            ].map(({ title, body, icon: Icon }) => (
              <div key={title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <Icon className="h-9 w-9 text-red-600" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-10">
            <Link to="/features" className="font-medium text-red-600 hover:text-red-500">
              Explore all features →
            </Link>
          </p>
        </Section>

        <div className="border-y border-gray-200 bg-white">
          <Section>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Who it is for</h2>
            <p className="mt-4 max-w-3xl text-gray-600">
              Teams accountable for life safety assets across buildings and campuses—not only fire professionals, but
              the people who actually execute routes and answer for documentation.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Hospitals & healthcare', icon: HeartPulse },
                { label: 'Schools & campuses', icon: School },
                { label: 'Churches & community facilities', icon: Church },
                { label: 'Property & facility management', icon: Building2 },
                { label: 'Industrial & commercial sites', icon: Factory },
                { label: 'Maintenance departments', icon: Wrench },
                { label: 'Safety & compliance leads', icon: ShieldCheck },
              ].map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <Icon className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <Section>
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Built for the real world</h2>
          <p className="mt-4 max-w-3xl text-gray-600">
            This product exists because inspection programs are messy: people leave, locations change, and 
            inspectors show up unannounced. We focus on what crews need on the floor—fast lookup, 
            clear status, and a durable record—not fancy buzzwords.
          </p>
        </Section>

        <div className="border-y border-gray-200 bg-white" id="plans-preview">
          <Section>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Plans</h2>
            <p className="mt-4 max-w-2xl text-gray-600">
              Four tiers so you can match capability to portfolio size. Details and FAQs live on the pricing page.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {['Basic', 'Pro', 'Elite', 'Enterprise'].map((name) => (
                <div
                  key={name}
                  className={`rounded-xl border bg-white p-6 shadow-sm ${
                    name === 'Pro' ? 'border-red-200 ring-2 ring-red-100' : 'border-gray-200'
                  }`}
                >
                  {name === 'Pro' ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Recommended</p>
                  ) : (
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Plan</p>
                  )}
                  <p className="mt-2 text-xl font-bold text-gray-900">{name}</p>
                  <p className="mt-2 text-sm text-gray-600">
                    {name === 'Enterprise'
                      ? 'Custom setup and contract terms.'
                      : 'Simple access based on your team size and units.'}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link
                to="/pricing"
                className="inline-flex rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
              >
                Compare plans
              </Link>
            </div>
          </Section>
        </div>

        <Section className="pb-20">
          <div className="rounded-2xl bg-red-600 px-6 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to tighten up your extinguisher program?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-red-100">
              Create an account, set up your organization, and start building the inventory and inspection rhythm your
              team can sustain.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex w-full justify-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-red-700 shadow hover:bg-red-50 sm:w-auto"
              >
                Get started
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex w-full justify-center rounded-md border border-red-400 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 sm:w-auto"
              >
                See how it works
              </Link>
            </div>
          </div>
        </Section>
      </PublicMarketingLayout>
    </>
  );
}
