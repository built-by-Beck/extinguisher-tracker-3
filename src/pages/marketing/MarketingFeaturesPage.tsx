import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Barcode,
  Building2,
  ClipboardCheck,
  Database,
  FileDown,
  History,
  MapPinned,
  MonitorSmartphone,
  TriangleAlert,
} from 'lucide-react';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { marketingSeo } from './marketingSeo.ts';

type FeatureBlockProps = {
  title: string;
  what: string;
  why: string;
  outcome: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

function FeatureBlock({ title, what, why, outcome, icon: Icon }: FeatureBlockProps) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-red-50 p-3">
          <Icon className="h-7 w-7 text-red-600" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <dl className="mt-4 space-y-4 text-sm text-gray-600">
            <div>
              <dt className="font-semibold text-gray-800">What it does</dt>
              <dd className="mt-1">{what}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-800">Why it matters</dt>
              <dd className="mt-1">{why}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-800">Practical outcome</dt>
              <dd className="mt-1">{outcome}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

export default function MarketingFeaturesPage() {
  const seo = marketingSeo.features;

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Features</h1>
            <p className="mt-4 max-w-3xl text-lg text-gray-600">
              A concise map of what Extinguisher Tracker supports for day-to-day inspection operations. Capabilities
              may vary by plan; use pricing to compare tiers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/pricing"
                className="inline-flex rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
              >
                View pricing
              </Link>
              <Link
                to="/signup"
                className="inline-flex rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-8 px-4 py-14 sm:px-6 sm:py-16">
          <FeatureBlock
            icon={Database}
            title="Extinguisher inventory management"
            what="Central record for extinguishers with the fields your program needs—identifiers, types, placement, and lifecycle context."
            why="If the inventory is wrong, every inspection and report built on top of it is wrong."
            outcome="Fewer missed units, cleaner handoffs between shifts, and a list leadership can trust."
          />
          <FeatureBlock
            icon={ClipboardCheck}
            title="Inspection workflow tracking"
            what="Structured inspection runs tied to workspaces and routes so crews know what to complete and when."
            why="Ad-hoc inspections produce inconsistent evidence and unclear accountability."
            outcome="Predictable completion, clearer ownership, and less scrambling before deadlines."
          />
          <FeatureBlock
            icon={Barcode}
            title="Barcode and asset lookup"
            what="Scan or search to pull the right extinguisher quickly instead of hunting through long lists."
            why="Field time is expensive; lookup friction causes skipped checks or wrong asset edits."
            outcome="Faster routes, fewer mis-tagged updates, and better confidence on the floor."
          />
          <FeatureBlock
            icon={FileDown}
            title="Compliance-oriented reporting"
            what="Reporting and exports that summarize status, history, and program health for internal review."
            why="You need answers when leadership, auditors, or partners ask what the status is."
            outcome="Less manual assembly in spreadsheets when questions land in your inbox."
          />
          <FeatureBlock
            icon={History}
            title="History, records, and audit trail"
            what="Durable record of inspection activity and important changes so prior work is discoverable later."
            why="Turnover and disputes are normal; memory is not a system of record."
            outcome="Defensible documentation when you need to reconstruct what happened and when."
          />
          <FeatureBlock
            icon={MonitorSmartphone}
            title="Mobile-friendly workflow"
            what="Interfaces intended for people walking buildings—not only desktop admins."
            why="Inspections happen in corridors, basements, and rooftops, not in cubicles."
            outcome="Higher completion rates and fewer “I will fix it when I am back at my desk” gaps."
          />
          <FeatureBlock
            icon={MapPinned}
            title="Location, building, and section organization"
            what="Organize assets by facility structure so assignments and reporting match how you operate."
            why="Large portfolios fail when navigation mirrors a spreadsheet instead of the campus map."
            outcome="Easier route planning, clearer scope per team, and reporting that matches real geography."
          />
          <FeatureBlock
            icon={TriangleAlert}
            title="Issue tracking"
            what="Surface failed items and follow-ups so corrective work does not disappear into notes."
            why="A failed inspection without a tracked next step is still a risk on the floor."
            outcome="Open issues are visible until closed, with less reliance on side channels."
          />
          <FeatureBlock
            icon={Building2}
            title="Reporting and export support"
            what="Pull data out for finance, procurement, or partner workflows when the in-app view is not enough."
            why="Organizations rarely live in a single tool; exports bridge to CMMS, CMMS tickets, and leadership decks."
            outcome="Less copy-paste, fewer transcription errors, and faster responses to cross-team requests."
          />
        </div>

        <div className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
            <p className="text-lg font-medium text-gray-900">Want the step-by-step flow?</p>
            <Link to="/how-it-works" className="mt-3 inline-block font-medium text-red-600 hover:text-red-500">
              Read how it works →
            </Link>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
