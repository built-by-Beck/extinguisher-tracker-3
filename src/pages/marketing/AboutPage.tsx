/**
 * About page — company mission, product overview, team info.
 * Matches existing marketing page styling (PublicMarketingLayout).
 *
 * Author: built_by_Beck
 */

import { Link } from 'react-router-dom';
import { Target, Users, Award, ShieldCheck } from 'lucide-react';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { marketingSeo } from './marketingSeo.ts';

export default function AboutPage() {
  const seo = marketingSeo.about;

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        {/* Hero */}
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">About Extinguisher Tracker</h1>
            <p className="mt-4 max-w-3xl text-lg text-gray-600">
              Extinguisher Tracker was built independently from field-level life safety experience and software
              development skill, with each feature added because real extinguisher programs needed it.
            </p>
          </div>
        </div>

        {/* Mission */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Our Mission</h2>
              <p className="mt-4 text-gray-600">
                Extinguisher Tracker was created to solve a common problem: fire extinguisher programs collect a lot
                of important information, but too much of that information gets trapped in paper, spreadsheets, and
                disconnected tools.
              </p>
              <p className="mt-4 text-gray-600">
                The product is intentionally practical. Inventory, locations, inspections, tags, reminders, reports,
                custom asset checks, offline sync, audit logs, lifecycle tracking, and AI support all exist because
                those are real needs that show up when teams are responsible for life safety work.
              </p>
              <p className="mt-4 text-gray-600">
                The builder behind the product is part of a rare overlap: someone with life safety field experience
                who also builds software. That combination keeps the program focused on useful workflow instead of
                bloated screens, vague dashboards, or features that sound good but do not help the person doing the work.
              </p>
              <p className="mt-4 text-gray-600">
                Extinguisher Tracker is developed separately and independently. The story is simple: identify a real
                need in extinguisher program management, build the tool that should have existed, and keep improving
                it around practical field use.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-red-50 p-3">
                    <Target className="h-7 w-7 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Our Goal</h3>
                    <p className="text-sm text-gray-600">Make fire safety compliance effortless</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-blue-50 p-3">
                    <Users className="h-7 w-7 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Our Team</h3>
                    <p className="text-sm text-gray-600">Built by a field-informed software developer</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-green-50 p-3">
                    <Award className="h-7 w-7 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Our Values</h3>
                    <p className="text-sm text-gray-600">Practicality, reliability, and clear records</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why choose us */}
        <section className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">
              Why Organizations Choose Us
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900">Built for the Field</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Designed around real-world inspection conditions: buildings with poor signal, changing locations,
                  tight routes, missing data, and the need to prove what happened later.
                </p>
              </article>
              <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900">No Junk Features</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Features are added when they solve a real workflow problem: faster lookup, cleaner records,
                  evidence capture, reminders, lifecycle clarity, or better handoffs.
                </p>
              </article>
              <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900">Built Independently</h3>
                <p className="mt-2 text-sm text-gray-600">
                  The product was developed as its own independent software project, with a focus on solving the
                  problems extinguisher programs face without tying the story to any outside organization.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-16">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <ShieldCheck className="h-7 w-7 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Compliance &amp; Standards</h2>
            <p className="mt-4 text-gray-600">
              Extinguisher Tracker is designed to support NFPA-aligned inspection workflows, documentation, and
              internal accountability. It helps teams organize the work and preserve evidence while final compliance
              decisions remain tied to adopted codes, qualified judgment, and local authority requirements.
            </p>
            <p className="mt-3 text-sm text-gray-500">
              AI guidance references the NFPA edition configured in Organization Settings, with NFPA 10 (2022) as the
              new-org fallback. Organizations should use the edition adopted by their local authority having jurisdiction.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900">NFPA 10 Aligned</h3>
                <p className="mt-1 text-sm text-gray-600">Monthly inspection requirements</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900">Documentation Support</h3>
                <p className="mt-1 text-sm text-gray-600">Records for internal safety programs</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900">Audit Ready</h3>
                <p className="mt-1 text-sm text-gray-600">Complete inspection records</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
            <p className="text-lg font-medium text-gray-900">Ready to modernize your fire safety program?</p>
            <Link
              to="/signup"
              className="mt-4 inline-block rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700"
            >
              Get started free
            </Link>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
