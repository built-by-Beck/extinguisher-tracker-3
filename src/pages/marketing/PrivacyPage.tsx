/**
 * Privacy Policy page.
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

export default function PrivacyPage() {
  const seo = marketingSeo.privacy;

  return (
    <>
      <MarketingPageMeta title={seo.title} description={seo.description} path={seo.path} />
      <PublicMarketingLayout>
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last Updated: March 29, 2026</p>

          <div className="mt-10">
            <Section num={1} title="Introduction">
              <p>
                Extinguisher Tracker (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed
                to protecting your privacy. This Privacy Policy explains how we collect, use, disclose,
                and safeguard your information when you use our service.
              </p>
              <p>
                Please read this Privacy Policy carefully. By using the Service, you consent to the
                data practices described in this policy.
              </p>
            </Section>

            <Section num={2} title="Information We Collect">
              <h3 className="mt-2 font-semibold text-gray-800">2.1 Information You Provide</h3>
              <p>We collect information that you voluntarily provide when using our Service:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Account information (name, email address, password)</li>
                <li>Fire extinguisher data (asset IDs, locations, serial numbers)</li>
                <li>Inspection records and notes</li>
                <li>Photos uploaded during inspections</li>
                <li>GPS location data (when you choose to capture it)</li>
                <li>Payment information (processed by Stripe)</li>
              </ul>

              <h3 className="mt-4 font-semibold text-gray-800">2.2 Automatically Collected Information</h3>
              <p>We automatically collect certain information when you use our Service:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Device information (browser type, operating system, device type)</li>
                <li>Usage data (pages visited, features used, time spent)</li>
                <li>IP address and general location information</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </Section>

            <Section num={3} title="How We Use Your Information">
              <p>We use the collected information for various purposes:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>To provide, maintain, and improve our Service</li>
                <li>To process your transactions and manage your subscription</li>
                <li>To send you technical notices, updates, and support messages</li>
                <li>To respond to your comments, questions, and requests</li>
                <li>To monitor and analyze usage patterns and trends</li>
                <li>To detect, prevent, and address technical issues and security threats</li>
                <li>To comply with legal obligations</li>
              </ul>
            </Section>

            <Section num={4} title="Cookies and Tracking Technologies">
              <p>
                We use cookies and similar tracking technologies to track activity on our Service and
                store certain information. Cookies are files with a small amount of data that are stored
                on your device.
              </p>
              <p>
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being
                sent. However, if you do not accept cookies, you may not be able to use some portions of
                our Service.
              </p>
            </Section>

            <Section num={5} title="Third-Party Services">
              <h3 className="mt-2 font-semibold text-gray-800">5.1 Google Firebase</h3>
              <p>
                We use Google Firebase for authentication, data storage, and file hosting. Firebase may
                collect and process data as described in{' '}
                <a
                  href="https://policies.google.com/privacy"
                  className="font-medium text-red-600 hover:text-red-500"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google&apos;s Privacy Policy
                </a>
                .
              </p>

              <h3 className="mt-4 font-semibold text-gray-800">5.2 Stripe</h3>
              <p>
                We use Stripe to process subscription payments. We do not store or have access to your
                full credit card information. Payment information is encrypted and processed securely by
                Stripe. See{' '}
                <a
                  href="https://stripe.com/privacy"
                  className="font-medium text-red-600 hover:text-red-500"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Stripe&apos;s Privacy Policy
                </a>
                .
              </p>
            </Section>

            <Section num={6} title="Data Storage and Security">
              <p>
                Your data is stored securely using Google Firebase&apos;s cloud infrastructure, which
                provides enterprise-grade security including:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Encryption in transit and at rest</li>
                <li>Regular security audits and updates</li>
                <li>Redundant backup systems</li>
                <li>Access controls and authentication</li>
              </ul>
              <p>
                While we implement reasonable security measures, no method of transmission over the
                Internet or electronic storage is 100% secure. We cannot guarantee absolute security of
                your data.
              </p>
            </Section>

            <Section num={7} title="Data Retention">
              <p>
                We retain your personal information for as long as your account is active or as needed
                to provide you services. If you wish to delete your account or request that we no longer
                use your information, you can do so through your account settings or by contacting us.
              </p>
              <p>
                We may retain and use your information as necessary to comply with legal obligations,
                resolve disputes, and enforce our agreements.
              </p>
            </Section>

            <Section num={8} title="Your Data Rights">
              <p>You have the following rights regarding your personal data:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li><strong>Access:</strong> You can access your personal data through your account dashboard</li>
                <li><strong>Correction:</strong> You can update or correct your information at any time</li>
                <li><strong>Deletion:</strong> You can request deletion of your account and associated data</li>
                <li><strong>Export:</strong> You can export your data via the reports feature</li>
                <li><strong>Objection:</strong> You can object to processing of your personal data</li>
                <li><strong>Portability:</strong> You can request a copy of your data in a structured format</li>
              </ul>
            </Section>

            <Section num={9} title="Children's Privacy">
              <p>
                Our Service is not intended for children under 13 years of age. We do not knowingly
                collect personal information from children under 13. If you are a parent or guardian
                and believe your child has provided us with personal information, please contact us.
              </p>
            </Section>

            <Section num={10} title="International Data Transfers">
              <p>
                Your information may be transferred to and maintained on computers located outside of
                your state, province, country, or other governmental jurisdiction where data protection
                laws may differ. By using our Service, you consent to such transfers.
              </p>
            </Section>

            <Section num={11} title="California Privacy Rights">
              <p>
                If you are a California resident, you have specific rights under the California Consumer
                Privacy Act (CCPA), including:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>The right to know what personal information is collected, used, and shared</li>
                <li>The right to delete personal information held by businesses</li>
                <li>The right to opt-out of the sale of personal information (we do not sell personal information)</li>
                <li>The right to non-discrimination for exercising your CCPA rights</li>
              </ul>
            </Section>

            <Section num={12} title="GDPR Compliance (EU Users)">
              <p>
                If you are located in the European Economic Area (EEA), you have rights under the General
                Data Protection Regulation (GDPR). We process your data based on the following legal
                grounds:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Your consent (which you can withdraw at any time)</li>
                <li>The performance of a contract with you</li>
                <li>Compliance with legal obligations</li>
                <li>Our legitimate interests (where not overridden by your rights)</li>
              </ul>
            </Section>

            <Section num={13} title="Do Not Track Signals">
              <p>
                We do not currently respond to &quot;Do Not Track&quot; signals from web browsers.
                Third-party services we use may track browsing activities across different websites.
              </p>
            </Section>

            <Section num={14} title="Multi-Tenant Data Isolation">
              <p>
                Extinguisher Tracker is a multi-tenant platform. Each organization&apos;s data is
                logically isolated and accessible only to authorized members of that organization. We
                enforce strict access controls at the database level to prevent cross-organization data
                access. Organization owners control member access and permissions within their
                organization.
              </p>
            </Section>

            <Section num={15} title="Changes to This Privacy Policy">
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by
                posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot;
                date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </Section>

            <Section num={16} title="Contact Us">
              <p>
                If you have any questions about this Privacy Policy or our data practices, please
                contact us through the contact information provided on our website.
              </p>
            </Section>
          </div>

          <div className="mt-10 border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-600">
              <Link to="/terms" className="font-medium text-red-600 hover:text-red-500">
                Terms of Service
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
