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
              Fire extinguisher inspections, organized for real facilities work
            </h1>
            <p className="mt-5 text-lg text-gray-600 sm:text-xl">
              Extinguisher Tracker helps your team keep inventory accurate, run inspections consistently, and
              maintain the records safety and maintenance programs depend on—not another generic checklist app.
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
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">The operational problem</h2>
            <p className="mt-4 max-w-3xl text-gray-600">
              Extinguisher programs generate a steady stream of dates, locations, pass/fail outcomes, and follow-up
              work. When that information lives in disconnected spreadsheets, paper routes, and inbox threads, it is
              easy to miss a unit, lose history under staff turnover, or scramble when someone asks for proof of
              inspection.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                'Hard to see what is due, what failed, and what is still open',
                'Inventory drift: tags, locations, and replacements get out of sync',
                'Weak audit trail when leadership or an AHJ asks for documentation',
                'Field teams need a workflow that works on phones, not only desktops',
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
            It is built as an operational system: structured inventory, inspection workflows tied to your
            organization, compliance-oriented status, and reporting you can use for internal QA and external
            questions. The goal is fewer surprises during survey season and cleaner handoffs between shifts and
            vendors.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Structured inventory',
                body: 'Track extinguishers with locations and context so the field team always knows what to inspect.',
                icon: MapPin,
              },
              {
                title: 'Inspection workflow',
                body: 'Run inspections in a repeatable sequence with clear outcomes and next steps.',
                icon: ClipboardList,
              },
              {
                title: 'Compliance visibility',
                body: 'See status and history so open issues are visible before they become incidents.',
                icon: ShieldCheck,
              },
              {
                title: 'AI-Powered Assistant',
                body: 'Get instant answers to NFPA 10 compliance and maintenance questions from our built-in assistant.',
                icon: Bot,
              },
              {
                title: 'Placement Calculator',
                body: 'Ensure you have the right coverage with our NFPA 10 compliant placement and quantity calculator.',
                icon: Calculator,
              },
              {
                title: 'Data Quality Tools',
                body: 'Keep your inventory clean with automatic duplicate detection and robust backup restoration.',
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
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Built from field reality</h2>
          <p className="mt-4 max-w-3xl text-gray-600">
            This product exists because inspection programs are messy in practice: turnover, split responsibilities,
            partial routes, and last-minute requests for reports. The workflows prioritize what crews need on the floor—
            fast lookup, clear status, and a durable record—not buzzwords or feature sprawl for its own sake.
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
                      ? 'Custom rollout and contract terms.'
                      : 'Full product access scoped to plan limits in billing.'}
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
