import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, FileCheck2, MapPinned, Package, Sparkles, Users, Wrench } from 'lucide-react';

const steps = [
  {
    title: 'Create your account and organization',
    body: 'Sign up, create your organization, and invite the team members who will inspect, review, and manage compliance.',
    icon: Users,
    links: [
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
    body: 'Start with quick manual entry or import your spreadsheet. You can clean up missing fields after import.',
    icon: Package,
    links: [
      { to: '/dashboard/inventory', label: 'Go to inventory' },
      { to: '/dashboard/import-guide', label: 'Read import guide' },
    ],
  },
  {
    title: 'Run Data Organizer cleanup',
    body: 'Use Data Organizer to fill in missing serials, types, years, and locations so compliance calculations stay accurate.',
    icon: Wrench,
    links: [
      { to: '/dashboard/data-organizer', label: 'Open Data Organizer' },
      { to: '/dashboard/data-organizer-guide', label: 'Read Data Organizer guide' },
    ],
  },
  {
    title: 'Create a workspace and start inspections',
    body: 'Create the current month workspace, assign scope, and inspect extinguishers. Use section timing to keep routes on pace.',
    icon: ClipboardList,
    links: [{ to: '/dashboard/workspaces', label: 'Open inspections' }],
  },
  {
    title: 'Review status and generate reports',
    body: 'Track pass/fail trends, close follow-ups, and export records for leadership, auditors, and fire marshals.',
    icon: FileCheck2,
    links: [
      { to: '/dashboard', label: 'View dashboard' },
      { to: '/dashboard/reports', label: 'Open reports' },
    ],
  },
] as const;

export default function GettingStarted() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Getting Started</h1>
        <p className="mt-2 text-sm text-gray-600">
          Follow this checklist to go from account setup to your first completed inspection cycle.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {steps.map(({ title, body, icon: Icon, links }, index) => (
          <section key={title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-red-600" />
                  <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
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
        <p className="flex items-start gap-2 text-sm text-blue-900">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          Ask AI for guidance while working: compliance questions, overdue checks, and inventory summaries.
          AI responses default to NFPA 10 (2022); confirm against your locally adopted edition before final decisions.
        </p>
      </div>

      <div className="mt-6 rounded-xl bg-gray-900 px-6 py-8 text-center">
        <h2 className="text-xl font-bold text-white">Ready to begin?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Start with locations and inventory, then create your current month workspace.
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
