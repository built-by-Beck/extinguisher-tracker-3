import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Barcode,
  Bell,
  Building2,
  Camera,
  Clock3,
  ClipboardCheck,
  Database,
  FileDown,
  History,
  MapPinned,
  MonitorSmartphone,
  Printer,
  QrCode,
  RefreshCcw,
  Share2,
  TriangleAlert,
  Users,
  Bot,
  Calculator,
  DatabaseZap,
  WifiOff,
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
              Built for teams that do not have time to chase notes, search regulations, rebuild spreadsheets, or lose
              field evidence. Capabilities may vary by plan; use pricing to compare tiers.
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
            icon={Bot}
            title="AI Maintenance Assistant"
            what="A built-in AI assistant that answers maintenance and compliance questions using NFPA 10 (2022) as the default reference."
            why="Busy crews should not need to stop and search external sites for code context or app notes."
            outcome="Faster decisions, fewer workflow interruptions, and consistent guidance while inspections are in progress."
          />
          <FeatureBlock
            icon={Clock3}
            title="Auto Timer for Route Pace"
            what="Automatic section timing tracks how long inspection work takes and keeps teams moving without manual stopwatch tracking."
            why="When timing is manual, sections drift, routes overrun, and follow-up planning becomes guesswork."
            outcome="Clear pacing visibility, better staffing estimates, and fewer missed checks at the end of a shift."
          />
          <FeatureBlock
            icon={Calculator}
            title="Compliance Placement Calculator"
            what="An interactive tool to determine required extinguisher quantities and types based on hazard class and floor area."
            why="Manual placement calculations are prone to error and time-consuming during site setup."
            outcome="Confident facility planning with advisory NFPA-aligned guidance that should still be confirmed against local requirements and AHJ direction."
          />
          <FeatureBlock
            icon={DatabaseZap}
            title="Data Quality and Backup"
            what="Tools to detect and merge duplicate records and restore full organization data from JSON backup files."
            why="Data entry errors and system migrations shouldn't compromise your inspection history."
            outcome="A clean, trusted inventory and peace of mind knowing your safety data is portable and recoverable."
          />
          <FeatureBlock
            icon={Database}
            title="Extinguisher inventory management"
            what="Central record for extinguishers with the fields your program needs—identifiers, types, placement, and lifecycle context."
            why="If the inventory is wrong, every inspection and report built on top of it is wrong."
            outcome="Fewer missed units, cleaner handoffs between shifts, and a list leadership can trust."
          />
          <FeatureBlock
            icon={RefreshCcw}
            title="Replacement and retirement lifecycle"
            what="Track active records, replaced units, retired assets, serial changes, and lifecycle context without losing prior history."
            why="Extinguishers do not stay static. Units get replaced, retired, moved, or corrected, and those changes need a clean trail."
            outcome="A clearer active inventory with less confusion when old tags, old serials, or replacement chains come up later."
          />
          <FeatureBlock
            icon={ClipboardCheck}
            title="Inspection workflow tracking"
            what="Structured inspection runs tied to workspaces and routes so crews know what to complete and when."
            why="Ad-hoc inspections produce inconsistent evidence and unclear accountability."
            outcome="Predictable completion, clearer ownership, and less scrambling before deadlines."
          />
          <FeatureBlock
            icon={ClipboardCheck}
            title="Custom asset inspections"
            what="Create inspection programs for non-extinguisher assets that still need recurring checks, notes, and follow-up visibility."
            why="Life safety teams often track more than one asset type, and those checks should not be forced into unrelated spreadsheets."
            outcome="One workflow for extinguisher work plus adjacent recurring inspections your team already has to manage."
          />
          <FeatureBlock
            icon={Barcode}
            title="Barcode and asset lookup"
            what="Scan or search to pull the right extinguisher and related notes instantly instead of hunting through long lists."
            why="Field time is expensive; lookup friction causes skipped checks, wrong asset edits, and lost context."
            outcome="Faster routes, cleaner updates, and less context switching while you are actively working."
          />
          <FeatureBlock
            icon={QrCode}
            title="QR links and tag workflows"
            what="Use QR links, printable lists, and tag printing to connect the physical extinguisher to the right digital record."
            why="A good asset program needs the person in front of the unit to land on the right information quickly."
            outcome="Less guessing in the field and a cleaner bridge between labels, scans, inspection forms, and records."
          />
          <FeatureBlock
            icon={Camera}
            title="Photo, GPS, and field notes"
            what="Capture inspection evidence, location context, and notes while the work is still fresh."
            why="Plain pass/fail records often leave teams reconstructing what happened after the route is over."
            outcome="Better evidence for follow-up decisions, internal reviews, and questions from safety leaders."
          />
          <FeatureBlock
            icon={WifiOff}
            title="Offline-ready sync queue"
            what="Support low-connectivity inspection work with offline storage and a sync queue when the connection comes back."
            why="Inspections happen in stairwells, basements, mechanical rooms, and remote buildings where signal is not guaranteed."
            outcome="Crews can keep moving instead of waiting for perfect connectivity."
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
            title="History, records, and audit logs"
            what="Durable inspection history plus dedicated audit logs for important activity and changes."
            why="Turnover and disputes are normal; memory is not a system of record."
            outcome="Defensible documentation when you need to reconstruct what happened and when."
          />
          <FeatureBlock
            icon={Bell}
            title="Notifications and reminders"
            what="In-app notification and reminder workflows help overdue work and follow-ups stay visible."
            why="Important inspection work should not depend on someone remembering to check a separate spreadsheet."
            outcome="More timely attention to upcoming, overdue, and unresolved work."
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
            icon={Users}
            title="Organizations, roles, and invites"
            what="Invite team members, separate access by organization, and use roles for owners, admins, inspectors, and viewers."
            why="The person inspecting in the field does not always need the same access as an owner or administrator."
            outcome="Cleaner collaboration across facilities, teams, and outside stakeholders."
          />
          <FeatureBlock
            icon={Share2}
            title="Guest access for limited visibility"
            what="Share limited guest views when someone needs to review records without becoming a full team member."
            why="Auditors, partners, and temporary reviewers often need answers without long-term access."
            outcome="More controlled sharing with less need to export or screenshot everything."
          />
          <FeatureBlock
            icon={Printer}
            title="Print-ready field support"
            what="Print inventory lists and tags when paper labels, backup lists, or physical binders are still part of the operation."
            why="Digital systems still need to connect to real buildings, labels, and field handoffs."
            outcome="Better continuity between the app, the asset label, and the technician standing in front of the unit."
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
            why="Organizations rarely live in a single tool; exports bridge to CMMS tools, tickets, and leadership decks."
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
