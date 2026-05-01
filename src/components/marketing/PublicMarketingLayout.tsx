import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { PublicAdSlot } from '../ads/PublicAdSlot.tsx';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-base font-semibold ${isActive ? 'text-red-600' : 'text-gray-700 hover:text-red-600'}`;

const MARKETING_PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Field-Built Fire Extinguisher Tracking', subtitle: 'Inspections. AI guidance. Offline-aware workflow.' },
  '/features': { title: 'Features', subtitle: 'The major workflows your extinguisher program needs in one place' },
  '/pricing': { title: 'Pricing', subtitle: 'Plans that scale with your AI-assisted program' },
  '/how-it-works': { title: 'How It Works', subtitle: 'From setup to field evidence, reports, sharing, and audit history' },
  '/about': { title: 'About', subtitle: 'Independently built from field-level life safety experience' },
  '/getting-started': { title: 'Getting Started', subtitle: 'From signup to a stronger inspection program' },
  '/faq': { title: 'FAQ', subtitle: 'Answers for setup, AI, field work, reports, sharing, and pricing' },
  '/terms': { title: 'Terms of Service', subtitle: 'Usage terms and legal guidelines' },
  '/privacy': { title: 'Privacy Policy', subtitle: 'How we collect, use, and protect your data' },
};

type PublicMarketingLayoutProps = {
  children: ReactNode;
};

export function PublicMarketingLayout({ children }: PublicMarketingLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pageInfo = MARKETING_PAGE_TITLES[location.pathname] ?? { title: 'Extinguisher Tracker', subtitle: '' };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <Link to="/" className="flex items-center gap-3.5" onClick={() => setMobileOpen(false)}>
            <img src="/logo.png" alt="Extinguisher Tracker" className="h-24 w-24 rounded-xl object-contain sm:h-28 sm:w-28" />
            <span className="text-3xl font-bold tracking-tight text-gray-900">Extinguisher <span className="text-red-600">Tracker</span></span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/features" className={navLinkClass}>
              Features
            </NavLink>
            <NavLink to="/pricing" className={navLinkClass}>
              Pricing
            </NavLink>
            <NavLink to="/how-it-works" className={(props) => `${navLinkClass(props)} whitespace-nowrap`}>
              How it works
            </NavLink>
            <NavLink to="/getting-started" className={navLinkClass}>
              Getting started
            </NavLink>
            <NavLink to="/faq" className={navLinkClass}>
              FAQ
            </NavLink>
            <Link
              to="/login"
              className="whitespace-nowrap text-base font-semibold text-gray-700 hover:text-red-600"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-red-600 px-5 py-2.5 text-base font-semibold text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Get started
            </Link>
          </nav>

          {mobileOpen ? (
            <button
              type="button"
              className="rounded-md p-2 text-gray-700 md:hidden"
              aria-expanded="true"
              aria-controls="marketing-mobile-nav"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-6 w-6" aria-hidden />
              <span className="sr-only">Close menu</span>
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md p-2 text-gray-700 md:hidden"
              aria-expanded="false"
              aria-controls="marketing-mobile-nav"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-6 w-6" aria-hidden />
              <span className="sr-only">Open menu</span>
            </button>
          )}
        </div>

        {mobileOpen ? (
          <div
            id="marketing-mobile-nav"
            className="border-t border-gray-200 bg-white px-4 py-4 md:hidden"
          >
            <div className="flex flex-col gap-3">
              <NavLink to="/" end className={navLinkClass} onClick={() => setMobileOpen(false)}>
                Home
              </NavLink>
              <NavLink to="/features" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                Features
              </NavLink>
              <NavLink to="/pricing" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                Pricing
              </NavLink>
              <NavLink to="/how-it-works" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                How it works
              </NavLink>
              <NavLink to="/getting-started" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                Getting started
              </NavLink>
              <NavLink to="/faq" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                FAQ
              </NavLink>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-700"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-red-600 px-4 py-2 text-center text-sm font-medium text-white"
                onClick={() => setMobileOpen(false)}
              >
                Get started
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {/* Hero banner with page title overlay */}
      <div className="relative bg-gray-900">
        <img
          src="/extinguisherTracker2.png"
          alt="Extinguisher Tracker — Fire Extinguisher Tracking Made Simple"
          className="mx-auto block w-[96%] object-contain py-1"
        />
        <div className="absolute inset-0 flex items-end justify-center pb-4 sm:pb-6">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:text-3xl md:text-4xl">
              {pageInfo.title}
            </h2>
            {pageInfo.subtitle && (
              <p className="mt-1 text-sm font-medium text-gray-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] sm:text-base">
                {pageInfo.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Top ad banner — below header */}
      <PublicAdSlot format="banner" className="border-b border-gray-200 bg-white px-4 py-2" />

      <main className="flex-1">{children}</main>

      {/* Bottom ad banner — above footer */}
      <PublicAdSlot format="banner" className="border-t border-gray-200 bg-white px-4 py-2" />

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Extinguisher Tracker" className="h-8 w-8 rounded-lg object-contain" />
                <p className="text-sm font-semibold text-red-600">Extinguisher Tracker</p>
              </div>
              <p className="mt-2 max-w-sm text-sm text-gray-600">
                Field-built inspection and compliance workflow software for teams responsible for fire extinguisher programs.
              </p>
            </div>
            <div className="flex flex-wrap gap-8 text-sm">
              <div className="flex flex-col gap-2">
                <span className="font-medium text-gray-900">Product</span>
                <Link to="/features" className="text-gray-600 hover:text-red-600">
                  Features
                </Link>
                <Link to="/pricing" className="text-gray-600 hover:text-red-600">
                  Pricing
                </Link>
                <Link to="/how-it-works" className="text-gray-600 hover:text-red-600">
                  How it works
                </Link>
                <Link to="/getting-started" className="text-gray-600 hover:text-red-600">
                  Getting started
                </Link>
                <Link to="/faq" className="text-gray-600 hover:text-red-600">
                  FAQ
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-medium text-gray-900">Account</span>
                <Link to="/login" className="text-gray-600 hover:text-red-600">
                  Sign in
                </Link>
                <Link to="/signup" className="text-gray-600 hover:text-red-600">
                  Create account
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-medium text-gray-900">Company</span>
                <Link to="/about" className="text-gray-600 hover:text-red-600">
                  About
                </Link>
                <Link to="/terms" className="text-gray-600 hover:text-red-600">
                  Terms of Service
                </Link>
                <Link to="/privacy" className="text-gray-600 hover:text-red-600">
                  Privacy Policy
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-medium text-gray-900">Contact</span>
                <a href="mailto:help@extinguishertracker.com" className="text-gray-600 hover:text-red-600">
                  Support
                </a>
                <a href="mailto:info@extinguishertracker.com" className="text-gray-600 hover:text-red-600">
                  General Inquiries
                </a>
                <a href="mailto:billing@extinguishertracker.com" className="text-gray-600 hover:text-red-600">
                  Billing
                </a>
              </div>
            </div>
          </div>
          <p className="mt-8 text-xs text-gray-500">
            © {new Date().getFullYear()} Extinguisher Tracker. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
