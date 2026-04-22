import { Link } from 'react-router-dom';
import { Building2, ClipboardList, FileText, LineChart, UserPlus, Bot } from 'lucide-react';
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
    title: 'Add facilities, buildings, and extinguisher records',
    body: 'Model locations the way your teams navigate them, then load or maintain inventory so every unit has a home in the system.',
    icon: Building2,
  },
  {
    step: 3,
    title: 'Perform inspections on a defined rhythm',
    body: 'Use workspaces, inspection flows, and section auto timers to complete routes on pace and keep work tied to the correct assets.',
    icon: ClipboardList,
  },
  {
    step: 4,
    title: 'Track issues and compliance status',
    body: 'Failed items and follow-ups stay visible until resolved, so open risk does not depend on someone remembering a sticky note.',
    icon: LineChart,
  },
  {
    step: 5,
    title: 'Generate reports and keep durable history',
    body: 'Export or summarize when leadership, partners, or internal QA needs evidence—without rebuilding spreadsheets from scratch.',
    icon: FileText,
  },
  {
    step: 6,
    title: 'Optimize and Scale with AI',
    body: 'Use the AI Maintenance Assistant for in-app NFPA 10 guidance (2022 default), quick inventory questions, and operational note recall while you work.',
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
              A straightforward path from setup to sustained operations with AI support, auto timer pacing, and audit-ready records.
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
            AI responses use NFPA 10 (2022) by default. Because jurisdictions and organizations may adopt different editions,
            your team should confirm final decisions against your adopted standard.
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
