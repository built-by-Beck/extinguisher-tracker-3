import { Link } from 'react-router-dom';
import { Building2, ClipboardList, FileText, LineChart, UserPlus, Bot, Share2, WifiOff } from 'lucide-react';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { marketingSeo } from './marketingSeo.ts';

const steps = [
  {
    step: 1,
    title: 'Create your account and organization',
    body: 'Sign up, then create or join the organization that owns the extinguisher program. Roles and access follow your membership in that org.',
    icon: UserPlus,
  },
  {
    step: 2,
    title: 'Add facilities, buildings, extinguishers, and tags',
    body: 'Model locations the way your teams navigate them, then load inventory, add QR/barcode context, and keep every unit tied to a clear home.',
    icon: Building2,
  },
  {
    step: 3,
    title: 'Perform inspections on a defined rhythm',
    body: 'Use monthly workspaces, inspection flows, photos, notes, GPS context, and section auto timers to complete routes on pace.',
    icon: ClipboardList,
  },
  {
    step: 4,
    title: 'Track issues and compliance status',
    body: 'Failed items, reminders, replacement history, custom asset checks, and follow-ups stay visible until resolved.',
    icon: LineChart,
  },
  {
    step: 5,
    title: 'Generate reports and keep durable history',
    body: 'Export, print, or summarize reports, audit logs, and activity history when leadership, partners, or internal QA needs evidence.',
    icon: FileText,
  },
  {
    step: 6,
    title: 'Keep field work moving when conditions are not perfect',
    body: 'Use mobile workflows, offline sync support, and QR lookup so teams can keep working in basements, stairwells, and remote areas.',
    icon: WifiOff,
  },
  {
    step: 7,
    title: 'Share limited visibility when needed',
    body: 'Invite team members with roles or use guest access when outside reviewers need visibility without full administrative access.',
    icon: Share2,
  },
  {
    step: 8,
    title: 'Optimize and Scale with AI',
    body: 'Use the AI Maintenance Assistant for in-app NFPA 10 guidance based on your configured reference, quick inventory questions, and operational note recall while you work.',
    icon: Bot,
  },
] as const;

export default function MarketingHowItWorksPage() {
  const seo = marketingSeo.howItWorks;

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">How it works</h1>
            <p className="mt-4 max-w-3xl text-lg text-gray-600">
              A straightforward path from setup to sustained operations with AI support, offline-aware field work, timed routes, and audit-ready records.
              Your exact screens and entitlements depend on your plan and configuration inside the app.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <ol className="space-y-10">
            {steps.map(({ step, title, body, icon: Icon }) => (
              <li key={step} className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-start">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">
                    {step}
                  </span>
                  <div className="rounded-lg bg-red-50 p-3 sm:ml-0">
                    <Icon className="h-7 w-7 text-red-600" aria-hidden />
                  </div>
                </div>
                <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-1">
                  <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                  <p className="mt-3 text-sm text-gray-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl text-sm text-gray-500">
            AI responses use the NFPA reference configured in Organization Settings, with NFPA 10 (2022) as the new-org
            fallback. Because jurisdictions and organizations may adopt different editions, your team should confirm
            final decisions against your adopted standard.
          </p>

          <div className="mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link
              to="/signup"
              className="inline-flex rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700"
            >
              Create account
            </Link>
            <Link to="/pricing" className="text-sm font-medium text-red-600 hover:text-red-500">
              Compare plans →
            </Link>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
