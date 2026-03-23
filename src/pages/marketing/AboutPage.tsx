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
              We are on a mission to modernize fire safety compliance and make inspections easier for
              facilities teams everywhere.
            </p>
          </div>
        </div>

        {/* Mission */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Our Mission</h2>
              <p className="mt-4 text-gray-600">
                Extinguisher Tracker was created to solve a common problem: managing fire extinguisher
                inspections is time-consuming, error-prone, and often relies on outdated paper-based
                systems.
              </p>
              <p className="mt-4 text-gray-600">
                We believe that fire safety compliance should be simple, efficient, and accessible to
                organizations of all sizes. Our cloud-based platform eliminates paperwork, reduces
                inspection time, and provides instant access to compliance documentation.
              </p>
              <p className="mt-4 text-gray-600">
                Built by safety-minded people for safety-focused teams, Extinguisher Tracker combines
                industry knowledge with modern technology to deliver a solution that actually works in
                the field.
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
                    <p className="text-sm text-gray-600">Built by Beck Publishing</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-green-50 p-3">
                    <Award className="h-7 w-7 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Our Values</h3>
                    <p className="text-sm text-gray-600">Quality, reliability, and customer success</p>
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
                  Designed by people who understand real-world inspections. We know the challenges of
                  working across buildings, connectivity gaps, and tight schedules.
                </p>
              </article>
              <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900">Always Improving</h3>
                <p className="mt-2 text-sm text-gray-600">
                  We regularly ship new features driven by customer feedback. Your input directly
                  shapes the future of the product.
                </p>
              </article>
              <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900">Responsive Support</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Our support team responds quickly and actually understands fire safety. We are here
                  to help you succeed, not just sell software.
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
              Extinguisher Tracker is designed to help you meet NFPA 10 and OSHA fire safety
              requirements. Our inspection checklists cover standard monthly criteria, ensuring
              comprehensive compliance documentation.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900">NFPA 10 Aligned</h3>
                <p className="mt-1 text-sm text-gray-600">Monthly inspection requirements</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900">OSHA Compliant</h3>
                <p className="mt-1 text-sm text-gray-600">Documentation standards</p>
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
