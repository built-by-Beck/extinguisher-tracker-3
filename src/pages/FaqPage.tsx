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
        a: 'AI guidance defaults to NFPA 10 (2022). If your jurisdiction adopts another edition, include that in your prompt and verify final decisions internally.',
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
