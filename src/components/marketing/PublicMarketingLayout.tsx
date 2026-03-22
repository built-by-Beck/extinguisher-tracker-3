import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Flame, Menu, X } from 'lucide-react';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium ${isActive ? 'text-red-600' : 'text-gray-700 hover:text-red-600'}`;

type PublicMarketingLayoutProps = {
  children: ReactNode;
};

export function PublicMarketingLayout({ children }: PublicMarketingLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-red-600" onClick={() => setMobileOpen(false)}>
            <Flame className="h-8 w-8 shrink-0" aria-hidden />
            <span className="text-lg font-bold tracking-tight">Extinguisher Tracker</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/features" className={navLinkClass}>
              Features
            </NavLink>
            <NavLink to="/pricing" className={navLinkClass}>
              Pricing
            </NavLink>
            <NavLink to="/how-it-works" className={navLinkClass}>
              How it works
            </NavLink>
            <Link
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-red-600"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Get started
            </Link>
          </nav>

          <button
            type="button"
            className="rounded-md p-2 text-gray-700 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="marketing-mobile-nav"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            <span className="sr-only">Menu</span>
          </button>
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

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-600">Extinguisher Tracker</p>
              <p className="mt-2 max-w-sm text-sm text-gray-600">
                Inspection and compliance workflow software for teams responsible for fire extinguisher programs.
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
