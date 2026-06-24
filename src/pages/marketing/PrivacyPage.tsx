/**
 * Privacy Policy — ExtinguisherTracker.com
 *
 * Author: built_by_Beck
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MarketingPageMeta } from '../../components/marketing/MarketingPageMeta.tsx';
import { PublicMarketingLayout } from '../../components/marketing/PublicMarketingLayout.tsx';
import { marketingSeo } from './marketingSeo.ts';

function Section({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-bold text-gray-900">
        {num}. {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-600">
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

export default function PrivacyPage() {
  const seo = marketingSeo.privacy;

  return (
    <>
      <MarketingPageMeta
        title={seo.title}
        description={seo.description}
        path={seo.path}
      />
      <PublicMarketingLayout>
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Privacy Policy for ExtinguisherTracker.com
          </h1>
          <p className="mt-2 text-sm text-gray-500">Last Updated: June 24, 2026</p>

          <div className="mt-8 space-y-3 text-sm leading-relaxed text-gray-600">
            <p>
              Extinguisher Tracker respects your privacy. This Privacy Policy
              explains how we collect, use, store, and protect information when
              you visit or use ExtinguisherTracker.com, including our website,
              web app, inspection tools, reports, account features, and related
              services.
            </p>
            <p>
              By using Extinguisher Tracker, you agree to the practices described
              in this Privacy Policy.
            </p>
          </div>

          <div className="mt-10">
            <Section num={1} title="Information We Collect">
              <p>We may collect the following types of information:</p>

              <Subsection title="Account Information">
                <p>
                  When you create an account or sign up for Extinguisher
                  Tracker, we may collect:
                </p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Company or organization name</li>
                  <li>Phone number, if provided</li>
                  <li>Login information</li>
                  <li>Subscription or account status</li>
                </ul>
              </Subsection>

              <Subsection title="Fire Extinguisher and Inspection Data">
                <p>When you use the service, you may enter or upload information such as:</p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Fire extinguisher asset numbers</li>
                  <li>Serial numbers</li>
                  <li>Barcode or QR code information</li>
                  <li>Location or vicinity descriptions</li>
                  <li>Inspection status</li>
                  <li>Notes</li>
                  <li>Inspection dates</li>
                  <li>Maintenance history</li>
                  <li>Photos uploaded for inspection or support purposes</li>
                  <li>Reports or exported inspection records</li>
                </ul>
              </Subsection>

              <Subsection title="Payment Information">
                <p>
                  If you purchase a paid plan, payment processing may be handled
                  by a third-party payment provider such as Stripe. We do not
                  store your full credit card number on our servers. Stripe may
                  collect and process payment and transaction information
                  according to its own privacy practices.
                </p>
              </Subsection>

              <Subsection title="Technical Information">
                <p>We may automatically collect certain technical information, including:</p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>IP address</li>
                  <li>Browser type</li>
                  <li>Device type</li>
                  <li>Operating system</li>
                  <li>Pages visited</li>
                  <li>Time and date of visits</li>
                  <li>App usage activity</li>
                  <li>Error logs</li>
                  <li>Performance data</li>
                </ul>
                <p>
                  This helps us improve speed, security, reliability, and user
                  experience.
                </p>
              </Subsection>
            </Section>

            <Section num={2} title="How We Use Information">
              <p>We use collected information to:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Provide and operate Extinguisher Tracker</li>
                <li>Create and manage user accounts</li>
                <li>
                  Allow users to inspect, search, and manage fire extinguisher
                  records
                </li>
                <li>Generate reports and inspection history</li>
                <li>Improve website and app performance</li>
                <li>Provide customer support</li>
                <li>Process subscriptions and payments</li>
                <li>Detect bugs, errors, abuse, or unauthorized access</li>
                <li>
                  Send service updates, account notices, or important system
                  messages
                </li>
                <li>Improve features, tools, and user experience</li>
                <li>Market our services, when allowed by law</li>
              </ul>
              <p>
                <strong>We do not sell your fire extinguisher inspection records.</strong>
              </p>
            </Section>

            <Section num={3} title="AI Features and Uploaded Content">
              <p>
                Extinguisher Tracker may include AI-assisted features that help
                users ask questions, review inspection-related situations, or
                organize information.
              </p>
              <p>
                If you upload photos, notes, or inspection details to use with AI
                features, that information may be processed to provide a response
                or service. You should not upload private, sensitive, or
                confidential information unless it is necessary for your use of
                the service.
              </p>
              <p>
                AI responses are provided for convenience and should not replace
                official code books, your company&apos;s policies, manufacturer
                instructions, licensed professionals, or the authority having
                jurisdiction.
              </p>
            </Section>

            <Section num={4} title="How We Share Information">
              <p>
                We may share information with trusted service providers only when
                needed to operate the service. These may include:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Website hosting providers</li>
                <li>Database and authentication providers</li>
                <li>Payment processors</li>
                <li>Email service providers</li>
                <li>Analytics or performance tools</li>
                <li>Customer support tools</li>
                <li>Security and fraud-prevention services</li>
              </ul>
              <p>
                For example, Google Firebase may be used for authentication,
                database, hosting, or app services. See{' '}
                <a
                  href="https://policies.google.com/privacy"
                  className="font-medium text-red-600 hover:text-red-500"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google&apos;s Privacy Policy
                </a>{' '}
                and{' '}
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
              <p>
                Extinguisher Tracker is a multi-tenant platform. Each
                organization&apos;s operational data is logically isolated and
                accessible only to authorized members of that organization.
              </p>
              <p>
                We may also disclose information if required by law, legal
                process, safety concerns, fraud prevention, or to protect our
                rights and users.
              </p>
            </Section>

            <Section num={5} title="Cookies and Tracking Technologies">
              <p>
                ExtinguisherTracker.com may use cookies, local storage, analytics
                tools, pixels, or similar technologies to:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Keep users logged in</li>
                <li>Remember preferences</li>
                <li>Improve site performance</li>
                <li>Understand how visitors use the website</li>
                <li>Measure advertising performance</li>
                <li>Improve marketing campaigns</li>
              </ul>
              <p>
                You may be able to disable cookies through your browser settings,
                but some features may not work correctly.
              </p>
            </Section>

            <Section num={6} title="Facebook and Advertising">
              <p>
                If you interact with our Facebook ads, submit a form, click an ad,
                or visit our website from an ad, we may receive information such
                as your name, email address, phone number, company information,
                or other details you choose to provide.
              </p>
              <p>We may use this information to:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Contact you about Extinguisher Tracker</li>
                <li>Provide demos or signup information</li>
                <li>Follow up on your request</li>
                <li>Improve advertising performance</li>
                <li>Measure ad results</li>
              </ul>
              <p>
                Meta may also collect and process information according to{' '}
                <a
                  href="https://www.facebook.com/privacy/policy/"
                  className="font-medium text-red-600 hover:text-red-500"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Meta&apos;s Privacy Policy
                </a>
                .
              </p>
            </Section>

            <Section num={7} title="Data Security">
              <p>
                We use reasonable technical and organizational measures to
                protect information from unauthorized access, loss, misuse, or
                alteration.
              </p>
              <p>
                However, no website, app, database, or internet transmission is
                100% secure. Users are responsible for keeping their login
                information private and using strong passwords.
              </p>
            </Section>

            <Section num={8} title="Data Retention">
              <p>We keep information as long as necessary to:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Provide the service</li>
                <li>Maintain inspection history</li>
                <li>Support account records</li>
                <li>Meet legal, tax, accounting, or business requirements</li>
                <li>Resolve disputes</li>
                <li>Enforce agreements</li>
                <li>Improve security and prevent abuse</li>
              </ul>
              <p>
                Users may request deletion of their account or certain personal
                information by contacting us.
              </p>
            </Section>

            <Section num={9} title="Your Choices and Rights">
              <p>Depending on where you live, you may have rights to:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of personal information</li>
                <li>Opt out of certain marketing communications</li>
                <li>Request a copy of your data</li>
                <li>Limit certain uses of your information</li>
              </ul>
              <p>
                California residents may have additional privacy rights under the
                CCPA, which gives California consumers more control over personal
                information collected by businesses.
              </p>
              <p>To make a privacy request, contact us using the information below.</p>
            </Section>

            <Section num={10} title="Email and Marketing Communications">
              <p>
                If you sign up, request information, or submit a form, we may
                contact you by email about Extinguisher Tracker.
              </p>
              <p>
                You can unsubscribe from marketing emails at any time by using
                the unsubscribe link in the email or by contacting us directly.
              </p>
              <p>
                We may still send important service-related messages, such as
                account, billing, security, or system notices.
              </p>
            </Section>

            <Section num={11} title="Children's Privacy">
              <p>
                Extinguisher Tracker is intended for businesses, organizations,
                facility teams, technicians, and adult users. It is not intended
                for children under 13.
              </p>
              <p>
                We do not knowingly collect personal information from children
                under 13. If we learn that we have collected information from a
                child, we will take reasonable steps to delete it.
              </p>
            </Section>

            <Section num={12} title="Third-Party Links">
              <p>
                Our website may contain links to third-party websites, services,
                or tools. We are not responsible for the privacy practices,
                policies, or content of third-party websites.
              </p>
              <p>
                You should review the privacy policies of any third-party services
                you use.
              </p>
            </Section>

            <Section num={13} title="Changes to This Privacy Policy">
              <p>
                We may update this Privacy Policy from time to time. When we make
                changes, we will update the &quot;Last Updated&quot; date above.
              </p>
              <p>
                Continued use of ExtinguisherTracker.com after changes means you
                accept the updated Privacy Policy.
              </p>
            </Section>

            <Section num={14} title="Contact Us">
              <p>
                For questions about this Privacy Policy or to request access,
                correction, or deletion of your information, contact us at:
              </p>
              <ul className="list-none space-y-1 pl-0">
                <li>
                  <strong>Extinguisher Tracker</strong>
                </li>
                <li>
                  Website:{' '}
                  <a
                    href="https://extinguishertracker.com"
                    className="font-medium text-red-600 hover:text-red-500"
                  >
                    ExtinguisherTracker.com
                  </a>
                </li>
                <li>
                  Email:{' '}
                  <a
                    href="mailto:support@extinguishertracker.com"
                    className="font-medium text-red-600 hover:text-red-500"
                  >
                    support@extinguishertracker.com
                  </a>
                </li>
              </ul>
            </Section>
          </div>

          <div className="mt-10 border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-600">
              <Link
                to="/terms"
                className="font-medium text-red-600 hover:text-red-500"
              >
                Terms of Service
              </Link>
              {' | '}
              <Link
                to="/about"
                className="font-medium text-red-600 hover:text-red-500"
              >
                About
              </Link>
              {' | '}
              <Link
                to="/"
                className="font-medium text-red-600 hover:text-red-500"
              >
                Back to Home
              </Link>
            </p>
          </div>
        </div>
      </PublicMarketingLayout>
    </>
  );
}
