import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

const faqSections = [
  {
    title: 'Setup and onboarding',
    items: [
      {
        q: 'What should we do first after creating an account?',
        a: 'Create or join your organization, add locations, then load extinguisher inventory. After that, create a workspace and run inspections.',
      },
      {
        q: 'Where do I invite team members?',
        a: 'Go to Settings and open the Members area. Owners/Admins can invite users and assign roles.',
      },
      {
        q: 'How should roles be used?',
        a: 'Use owner/admin access for people managing setup, billing, members, and program configuration. Inspector and viewer access should stay focused on field work and record visibility.',
      },
      {
        q: 'Can users upload profile photos or organization logos?',
        a: 'Users choose from preset avatars instead of uploading personal profile photos. Organization logo branding is available to the organization creator on Pro, Elite, and Enterprise plans with strict image type, size, path, and permission checks.',
      },
    ],
  },
  {
    title: 'Inventory and import',
    items: [
      {
        q: 'Do we need every field before importing?',
        a: 'No. Start with core fields and use Data Organizer to fill missing details after import.',
      },
      {
        q: 'What happens if asset IDs are duplicated?',
        a: 'Rows with duplicate asset IDs are skipped so existing records are not overwritten unexpectedly.',
      },
      {
        q: 'Where can I find the import format?',
        a: 'Use the Import Guide from Inventory for templates and exact column expectations.',
      },
      {
        q: 'How do barcode, QR, and tag printing fit together?',
        a: 'Barcode search and QR links help field users reach the right record quickly. Printable lists and tag printing help connect the digital record back to physical equipment and route paperwork.',
      },
      {
        q: 'What should we do when an extinguisher is replaced?',
        a: 'Use Replace Extinguisher from the active unit detail page instead of overwriting history by hand. The modal confirms the old unit, lets admins reuse the existing asset/location ID or intentionally enter a new asset ID, archives the old serial/barcode/unit details, and updates the active record with the replacement unit.',
      },
      {
        q: 'Where can we review old replaced units or return one as a spare?',
        a: 'Open Replaced Extinguishers from the sidebar. It shows each retired old unit beside its current replacement, lets owners/admins track waiting-for-service, sent-for-service, discarded, or returned status, and can create a returned old unit as a new active spare record with a unique spare asset ID.',
      },
      {
        q: 'What is the difference between marked expired and possible expired candidates?',
        a: 'Marked Expired is the official list: only active, non-deleted extinguishers where the expired flag has been saved. Possible Candidates is an advisory follow-up list for active units manufactured 6+ years ago that are not marked expired yet.',
      },
    ],
  },
  {
    title: 'Inspections and compliance',
    items: [
      {
        q: 'How do we start monthly inspections?',
        a: 'Open Inspections, create the active month workspace, then inspect items by location/section and resolve follow-ups.',
      },
      {
        q: 'How does AI help during inspections?',
        a: 'AI can help answer compliance questions, summarize overdue items, and reduce context switching while technicians are in the field.',
      },
      {
        q: 'Which NFPA edition does AI use?',
        a: 'AI uses the NFPA reference configured in Organization Settings. New organizations fall back to NFPA 10 (2022) until an owner/admin selects another edition or adds AHJ-specific notes; final decisions still need qualified internal review.',
      },
      {
        q: 'Does the placement calculator guarantee compliance?',
        a: 'No. Treat it as a planning aid. Final placement and compliance decisions should be confirmed against your adopted code edition, internal policy, qualified judgment, and AHJ direction.',
      },
      {
        q: 'What should we do after working offline?',
        a: 'Open the Sync Queue and confirm queued work has synced before treating reports or dashboard totals as final.',
      },
    ],
  },
  {
    title: 'Reports, sharing, and advanced workflows',
    items: [
      {
        q: 'Where do notifications and reminders show up?',
        a: 'Use Notifications to review due, overdue, and follow-up activity. Reports and dashboards help summarize the overall program status.',
      },
      {
        q: 'Where can I see audit history?',
        a: 'Open Audit Logs to review important activity and changes. These records help reconstruct what happened without relying on memory or side notes.',
      },
      {
        q: 'Can outside reviewers see records?',
        a: 'Guest access is designed for limited visibility when someone needs to review shared information without becoming a full team member.',
      },
      {
        q: 'Can we inspect non-extinguisher assets?',
        a: 'Yes. Custom asset inspections support recurring checks for other assets that need structured inspection records, notes, and follow-up tracking.',
      },
    ],
  },
] as const;

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-7 w-7 text-red-600" />
          <h1 className="text-2xl font-bold text-gray-900">FAQ</h1>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Quick answers for setup, imports, inspections, AI assistance, and day-to-day operations.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {faqSections.map((section) => (
          <section key={section.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
            <dl className="mt-4 space-y-4">
              {section.items.map((item) => (
                <div key={item.q} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <dt className="text-sm font-semibold text-gray-900">{item.q}</dt>
                  <dd className="mt-2 text-sm text-gray-600">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-gray-900 px-6 py-8 text-center">
        <h2 className="text-xl font-bold text-white">Need a step-by-step walkthrough?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Use Getting Started for the full flow from account setup to completed inspections.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard/getting-started"
            className="inline-flex rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
          >
            Open Getting Started
          </Link>
          <Link
            to="/dashboard/workspaces"
            className="inline-flex rounded-lg border border-gray-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Go to inspections
          </Link>
        </div>
      </div>
    </div>
  );
}
