import { Link } from 'react-router-dom';
import { Bell, ClipboardList, FileText, MapPinned, Package, Printer, Share2, Sparkles, Users, WifiOff, Wrench } from 'lucide-react';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { marketingSeo } from './marketingSeo.ts';

const steps = [
  {
    title: 'Create your account and organization',
    body: 'Sign up, create your organization, and invite the people who run inspections and compliance reviews.',
    icon: Users,
  },
  {
    title: 'Set up locations and structure',
    body: 'Add buildings, floors, and sections so every extinguisher can be tracked in the right place.',
    icon: MapPinned,
  },
  {
    title: 'Load inventory quickly',
    body: 'Add units manually or import your spreadsheet, then connect records to barcodes, QR links, and printable tag workflows.',
    icon: Package,
  },
  {
    title: 'Clean up missing details',
    body: 'Use Data Organizer to fill missing serials, types, and years so compliance data stays reliable.',
    icon: Wrench,
  },
  {
    title: 'Run inspections and track outcomes',
    body: 'Create your current workspace, inspect assets, capture photos, add notes, and keep pace with timer-backed section workflows.',
    icon: ClipboardList,
  },
  {
    title: 'Keep field work synced',
    body: 'Use mobile and offline-oriented workflows so low-signal areas do not stop the route. Check the sync queue before relying on final records.',
    icon: WifiOff,
  },
  {
    title: 'Turn on reminders and review reports',
    body: 'Use notifications, reports, exports, and audit logs to see what is due, what failed, and what evidence is ready to share.',
    icon: FileText,
  },
  {
    title: 'Print, share, and expand the program',
    body: 'Print lists or tags, invite team members, share limited guest access, and add custom asset inspections when your program grows.',
    icon: Share2,
  },
  {
    title: 'Use AI while you work',
    body: 'Ask in-app AI for maintenance, NFPA-aligned guidance, inventory questions, and operational note recall without stopping to search external sites.',
    icon: Sparkles,
  },
] as const;

export default function MarketingGettingStartedPage() {
  const seo = marketingSeo.gettingStarted;

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Getting Started</h1>
            <p className="mt-4 text-lg text-gray-600">
              A straightforward path from first login to a stronger extinguisher program: inventory, inspections,
              evidence, reminders, reports, sharing, and cleanup.
            </p>
          </div>

          <ol className="mt-10 space-y-4">
            {steps.map(({ title, body, icon: Icon }, index) => (
              <li key={title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-red-600" />
                      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm text-blue-900">
              AI guidance uses the NFPA reference configured in Settings, with NFPA 10 (2022) as the new-org fallback.
              The placement calculator and AI assistant are planning and guidance tools; teams should align final
              decisions with their locally adopted edition and AHJ direction.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Field evidence',
                body: 'Use photos, notes, GPS context, QR lookup, and offline sync support while work is happening.',
                icon: Bell,
              },
              {
                title: 'Physical workflow',
                body: 'Use printable lists and tag printing to connect the digital record to the real extinguisher.',
                icon: Printer,
              },
              {
                title: 'Program expansion',
                body: 'Use custom asset inspections, guest access, and team roles as your operation grows.',
                icon: Users,
              },
            ].map(({ title, body, icon: Icon }) => (
              <article key={title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <Icon className="h-5 w-5 text-red-600" aria-hidden />
                <h2 className="mt-3 text-sm font-semibold text-gray-900">{title}</h2>
                <p className="mt-2 text-sm text-gray-600">{body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-gray-900 px-6 py-10 text-center">
            <h2 className="text-2xl font-bold text-white">Ready to set up your program?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-300">
              Start your account, load inventory, and complete your first inspection run.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700"
              >
                Create account
              </Link>
              <Link
                to="/faq"
                className="inline-flex rounded-md border border-gray-500 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
              >
                View FAQ
              </Link>
            </div>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
