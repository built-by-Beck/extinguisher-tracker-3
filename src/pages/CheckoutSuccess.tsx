import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  MapPinned,
  Package,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useOrg } from '../hooks/useOrg.ts';
import { PLANS } from '../lib/planConfig.ts';
import { TRIAL_DAYS } from '../lib/billingConfig.ts';

const HERO_IMAGE = '/extinguishertracker3.png';

const nextSteps = [
  {
    icon: MapPinned,
    title: 'Add your locations',
    body: 'Build your site map so every extinguisher has a clear home for routes and reports.',
    to: '/dashboard/locations',
    label: 'Set up locations',
  },
  {
    icon: Package,
    title: 'Load your inventory',
    body: 'Enter extinguishers manually or import your spreadsheet in minutes.',
    to: '/dashboard/inventory',
    label: 'Go to inventory',
  },
  {
    icon: ClipboardList,
    title: 'Run your first inspection',
    body: 'Create a workspace, scan or tap an asset, and capture audit-ready records.',
    to: '/dashboard/workspaces',
    label: 'Start inspecting',
  },
] as const;

function formatPlanLabel(plan: string | null | undefined): string | null {
  if (!plan) return null;
  return PLANS.find((entry) => entry.name === plan)?.displayName ?? plan;
}

export default function CheckoutSuccess() {
  const { org, orgLoading } = useOrg();
  const planLabel = formatPlanLabel(org?.plan);
  const isTrialing = org?.subscriptionStatus === 'trialing';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(239,68,68,0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(251,146,60,0.25), transparent 40%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 sm:px-6 lg:py-14">
        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-500/10 px-4 py-1.5 text-sm font-medium text-green-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Payment complete
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Welcome aboard.
              <span className="mt-2 block bg-gradient-to-r from-red-300 via-orange-200 to-yellow-200 bg-clip-text text-transparent">
                Your team is ready to stay compliant.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-lg text-gray-300 sm:text-xl">
              {orgLoading ? (
                'Setting up your subscription…'
              ) : planLabel ? (
                <>
                  <span className="font-semibold text-white">{org?.name}</span> is on the{' '}
                  <span className="font-semibold text-white">{planLabel}</span> plan
                  {isTrialing ? (
                    <> — your {TRIAL_DAYS}-day free trial starts now.</>
                  ) : (
                    <> — billing is active.</>
                  )}
                </>
              ) : (
                <>
                  Your subscription is activating now. Head to the dashboard to add locations, load
                  inventory, and run your first inspection.
                </>
              )}
            </p>

            <p className="mt-4 flex items-start gap-2 text-sm text-gray-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              NFPA-ready workflows, AI guidance on Pro and Elite, and audit trails that hold up
              when the fire marshal asks questions.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/dashboard/getting-started"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-gray-950"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Start the setup guide
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-gray-950"
              >
                Go to dashboard
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              <div
                className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-red-600/40 via-orange-500/20 to-transparent blur-2xl"
                aria-hidden
              />
              <img
                src={HERO_IMAGE}
                alt="Extinguisher Tracker — fire safety compliance software"
                className="relative w-full rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10"
              />
            </div>
          </div>
        </div>

        <section className="mt-12 border-t border-white/10 pt-10 lg:mt-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-red-300">
            Your first three moves
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {nextSteps.map(({ icon: Icon, title, body, to, label }) => (
              <article
                key={title}
                className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              >
                <Icon className="h-5 w-5 text-red-400" aria-hidden />
                <h3 className="mt-3 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-gray-400">{body}</p>
                <Link
                  to={to}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-red-300 hover:text-red-200"
                >
                  {label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
