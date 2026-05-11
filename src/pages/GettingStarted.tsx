import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  FileCheck2,
  MapPinned,
  Package,
  Printer,
  Share2,
  Sparkles,
  Users,
  WifiOff,
  Wrench,
  Archive,
} from 'lucide-react';

const steps = [
  {
    title: 'Create your account and organization',
    body: 'Sign up, create your organization, choose a preset profile avatar, and invite the team members who will inspect, review, and manage compliance. Organization creators can manage organization profile details from Profile.',
    icon: Users,
    links: [
      { to: '/dashboard/profile', label: 'Open profile' },
      { to: '/dashboard/settings', label: 'Open organization settings' },
      { to: '/dashboard/members', label: 'Invite members' },
    ],
  },
  {
    title: 'Set up locations and sections',
    body: 'Build your location tree first so each extinguisher has a clear home for routes, reports, and audits.',
    icon: MapPinned,
    links: [{ to: '/dashboard/locations', label: 'Set up locations' }],
  },
  {
    title: 'Add or import extinguishers',
    body: 'Start with quick manual entry or import your spreadsheet. Add barcode/QR context where you have it, then clean up missing fields after import.',
    icon: Package,
    links: [
      { to: '/dashboard/inventory', label: 'Go to inventory' },
      { to: '/dashboard/import-guide', label: 'Read import guide' },
    ],
  },
  {
    title: 'Manage replacements and spare returns',
    body: 'When a physical unit is replaced, confirm the old details, choose whether to reuse or change the asset ID, and review archived retired-unit details from Replaced Extinguishers. Returned old units can be added back as active spare inventory with a new spare asset ID.',
    icon: Archive,
    links: [
      {
        to: '/dashboard/replaced-extinguishers',
        label: 'Open replaced extinguishers',
      },
    ],
  },
  {
    title: 'Run Data Organizer cleanup',
    body: 'Use Data Organizer to fill in missing serials, types, years, and locations so compliance calculations stay accurate.',
    icon: Wrench,
    links: [
      { to: '/dashboard/data-organizer', label: 'Open Data Organizer' },
      {
        to: '/dashboard/data-organizer-guide',
        label: 'Read Data Organizer guide',
      },
    ],
  },
  {
    title: 'Create a workspace and start inspections',
    body: 'Create the current month workspace, assign scope, and inspect extinguishers. Use section timing, photos, notes, and GPS context to keep routes on pace with better evidence.',
    icon: ClipboardList,
    links: [{ to: '/dashboard/workspaces', label: 'Open inspections' }],
  },
  {
    title: 'Use the AI assistant as your on-call compliance partner',
    body: 'On Pro, Elite, and Enterprise plans, the AI assistant is available throughout the app. Ask compliance questions ("How far apart should extinguishers be in a Class B hazard area per NFPA 2022?"), get overdue summaries ("Which units are past their annual inspection date?"), draft inspection notes from rough field descriptions ("Write a follow-up note for Unit A-12: gauge was slightly low, recheck in 30 days"), or upload a temporary photo for analysis. The AI uses your configured NFPA reference and keeps session context so follow-up questions build naturally without starting over.',
    icon: Sparkles,
    links: [{ to: '/dashboard/faq', label: 'See AI example questions' }],
  },
  {
    title: 'Check offline sync before closing the day',
    body: 'If crews worked in low-signal areas, review the sync queue so queued inspection work reaches the system before reports are treated as final.',
    icon: WifiOff,
    links: [{ to: '/dashboard/sync-queue', label: 'Open sync queue' }],
  },
  {
    title: 'Print lists and tags for the field',
    body: 'Use printable inventory lists and tag printing when you need physical labels, backup paper, or handoff packets for routes.',
    icon: Printer,
    links: [
      { to: '/dashboard/inventory/print', label: 'Print inventory list' },
      { to: '/dashboard/inventory/print-tags', label: 'Print tags' },
    ],
  },
  {
    title: 'Review status and generate reports',
    body: 'Track pass/fail trends, notifications, audit logs, follow-ups, and reports that identify each listed extinguisher by asset number, serial number, location, section, and vicinity. Build focused reports for failed or expired units, passed units, pending inspections, or replacement candidates, sorted by location by default.',
    icon: FileCheck2,
    links: [
      { to: '/dashboard', label: 'View dashboard' },
      { to: '/dashboard/notifications', label: 'Open notifications' },
      { to: '/dashboard/reports', label: 'Open reports' },
      { to: '/dashboard/audit-logs', label: 'Open audit logs' },
    ],
  },
  {
    title: 'Expand access and inspection scope',
    body: 'Invite users by role, use guest access when limited visibility is enough, and add custom asset inspections for other recurring safety checks.',
    icon: Share2,
    links: [
      { to: '/dashboard/members', label: 'Manage members' },
      {
        to: '/dashboard/custom-asset-inspections',
        label: 'Open custom assets',
      },
    ],
  },
] as const;

export default function GettingStarted() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Getting Started</h1>
        <p className="mt-2 text-sm text-gray-600">
          Follow this checklist to go from account setup to your first completed
          inspection cycle.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {steps.map(({ title, body, icon: Icon, links }, index) => (
          <section
            key={title}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-red-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    {title}
                  </h2>
                </div>
                <p className="mt-2 text-sm text-gray-600">{body}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {links.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      {link.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Pro+ tip: the AI is built for active field work
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Ask compliance questions like{' '}
              <span className="font-medium">
                "Can you tell me how far extinguishers are supposed to be apart
                according to NFPA 2022?"
              </span>{' '}
              — request an overdue summary, upload a temporary photo for
              analysis, or say{' '}
              <span className="font-medium">
                "Draft a follow-up note for this unit: tamper seal broken, gauge
                in green, needs recheck next week"
              </span>{' '}
              and get clean note language ready to copy. The AI retains context
              within the session so follow-up questions build naturally. Confirm
              final decisions against your locally adopted code edition and AHJ
              direction.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-gray-900 px-6 py-8 text-center">
        <h2 className="text-xl font-bold text-white">Ready to begin?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Start with locations and inventory, then create your current month
          workspace.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard/locations"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
          >
            Set up locations
          </Link>
          <Link
            to="/dashboard/inventory"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Go to inventory
          </Link>
        </div>
      </div>
    </div>
  );
}
