/**
 * Terms of Service page.
 * Matches existing marketing page styling (PublicMarketingLayout).
 *
 * TODO: Replace placeholder legal text with lawyer-reviewed content before launch.
 *
 * Author: built_by_Beck
 */

import { Link } from 'react-router-dom';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { marketingSeo } from './marketingSeo.ts';

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-bold text-gray-900">
        {num}. {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const seo = marketingSeo.terms;

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
          <p className="mt-2 text-sm text-gray-500">Last Updated: March 22, 2026</p>

          <div className="mt-10">
            <Section num={1} title="Acceptance of Terms">
              <p>
                By accessing and using Extinguisher Tracker (&quot;the Service&quot;), you accept and agree to
                be bound by the terms and provisions of this agreement. If you do not agree to these
                Terms of Service, please do not use the Service.
              </p>
            </Section>

            <Section num={2} title="Description of Service">
              <p>
                Extinguisher Tracker provides a cloud-based platform for managing fire extinguisher
                inspections, tracking compliance, and generating reports. The Service includes features
                such as:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Fire extinguisher inventory management</li>
                <li>Inspection tracking and documentation</li>
                <li>Photo and GPS location capture</li>
                <li>Report generation and data export</li>
                <li>Barcode scanning and asset lookup</li>
              </ul>
            </Section>

            <Section num={3} title="User Accounts">
              <p>To use the Service, you must create an account. You are responsible for:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use of your account</li>
                <li>Providing accurate, current, and complete information during registration</li>
              </ul>
            </Section>

            <Section num={4} title="Subscription and Payment">
              <p>Access to the Service requires a paid subscription. By subscribing, you agree to:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Pay all fees associated with your chosen subscription plan</li>
                <li>Automatic renewal of your subscription unless cancelled</li>
                <li>That all fees are non-refundable except as required by law</li>
                <li>Price changes with 30 days advance notice</li>
              </ul>
            </Section>

            <Section num={5} title="User Conduct">
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Violate any laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Transmit malware or malicious code</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
              </ul>
            </Section>

            <Section num={6} title="Data and Privacy">
              <p>
                Your use of the Service is also governed by our{' '}
                <Link to="/privacy" className="font-medium text-red-600 hover:text-red-500">
                  Privacy Policy
                </Link>
                . We collect, use, and protect your data as described in our Privacy Policy. You retain
                all rights to your data, and you may export or delete your data at any time.
              </p>
            </Section>

            <Section num={7} title="Intellectual Property">
              <p>
                The Service, including all content, features, and functionality, is owned by
                Extinguisher Tracker and is protected by copyright, trademark, and other intellectual
                property laws. You are granted a limited, non-exclusive, non-transferable license to
                access and use the Service for its intended purpose.
              </p>
            </Section>

            <Section num={8} title="Disclaimers and Limitations of Liability">
              <p className="uppercase">
                The Service is provided &quot;as is&quot; and &quot;as available&quot; without
                warranties of any kind, either express or implied. We do not warrant that the Service
                will be uninterrupted, error-free, or completely secure.
              </p>
              <p className="uppercase">
                To the maximum extent permitted by law, we shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, or any loss of profits or
                revenues.
              </p>
            </Section>

            <Section num={9} title="Compliance Disclaimer">
              <p>
                While Extinguisher Tracker is designed to help you meet NFPA 10 and OSHA fire safety
                requirements, you are solely responsible for ensuring compliance with all applicable
                laws and regulations. The Service is a tool to assist with compliance management, not a
                substitute for professional fire safety expertise or legal advice.
              </p>
            </Section>

            <Section num={10} title="Termination">
              <p>
                We reserve the right to suspend or terminate your account and access to the Service at
                any time, with or without notice, for conduct that we believe violates these Terms of
                Service or is harmful to other users, us, or third parties.
              </p>
              <p>
                You may cancel your subscription at any time through your account settings. Upon
                cancellation, you will continue to have access until the end of your current billing
                period.
              </p>
            </Section>

            <Section num={11} title="Changes to Terms">
              <p>
                We reserve the right to modify these Terms of Service at any time. We will notify you
                of any material changes by email or through the Service. Your continued use of the
                Service after such modifications constitutes acceptance of the updated terms.
              </p>
            </Section>

            <Section num={12} title="Governing Law">
              <p>
                These Terms of Service shall be governed by and construed in accordance with the laws
                of the jurisdiction in which Extinguisher Tracker operates, without regard to its
                conflict of law provisions.
              </p>
            </Section>

            <Section num={13} title="Contact Information">
              <p>
                If you have any questions about these Terms of Service, please contact us through the
                contact information provided on our website.
              </p>
            </Section>
          </div>

          <div className="mt-10 border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-600">
              <Link to="/privacy" className="font-medium text-red-600 hover:text-red-500">
                Privacy Policy
              </Link>
              {' | '}
              <Link to="/about" className="font-medium text-red-600 hover:text-red-500">
                About
              </Link>
              {' | '}
              <Link to="/" className="font-medium text-red-600 hover:text-red-500">
                Back to Home
              </Link>
            </p>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
