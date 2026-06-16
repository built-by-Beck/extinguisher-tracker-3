import { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  XCircle,
} from 'lucide-react';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';
import { OfflineBanner } from '../offline/OfflineBanner.tsx';
import { AiAssistantPanel } from '../ai/AiAssistantPanel.tsx';
import { DashboardAdBanner } from '../ads/DashboardAdBanner.tsx';
import { AdSlot } from '../ads/AdSlot.tsx';
import { useOrg } from '../../hooks/useOrg.ts';
import { hasFeature } from '../../lib/planConfig.ts';
import { readBillingIntervalPreference, settingsBillingPath } from '../../lib/billingIntervalPreference.ts';

const BANNER_PREF_KEY = 'ex3-hide-banner';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/profile': 'Profile',
  '/dashboard/inventory': 'Inventory',
  '/dashboard/replaced-extinguishers': 'Replaced Extinguishers',
  '/dashboard/custom-asset-inspections': 'Custom Asset Inspections',
  '/dashboard/members': 'Members',
  '/dashboard/workspaces': 'Inspections',
  '/dashboard/locations': 'Locations',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/sync-queue': 'Sync Queue',
  '/dashboard/reports': 'Reports',
  '/dashboard/audit-logs': 'Audit Logs',
  '/dashboard/settings': 'Organization Settings',
  '/dashboard/data-organizer': 'Data Organizer',
  '/dashboard/calculator': 'Fire Extinguisher Calculator',
  '/dashboard/getting-started': 'Getting Started',
  '/dashboard/faq': 'FAQ',
  '/dashboard/import-guide': 'Import Guide',
};

/** Per-page header colors — fire-protection palette with blue/green accents */
const PAGE_COLORS: Record<string, { bg: string; bgHidden: string }> = {
  '/dashboard': { bg: 'bg-gray-900', bgHidden: 'bg-gray-800' },
  '/dashboard/profile': { bg: 'bg-slate-900', bgHidden: 'bg-slate-800' },
  '/dashboard/inventory': { bg: 'bg-amber-800', bgHidden: 'bg-amber-700' },
  '/dashboard/replaced-extinguishers': {
    bg: 'bg-orange-900',
    bgHidden: 'bg-orange-800',
  },
  '/dashboard/custom-asset-inspections': {
    bg: 'bg-indigo-900',
    bgHidden: 'bg-indigo-800',
  },
  '/dashboard/workspaces': { bg: 'bg-red-800', bgHidden: 'bg-red-700' },
  '/dashboard/locations': { bg: 'bg-blue-800', bgHidden: 'bg-blue-700' },
  '/dashboard/members': { bg: 'bg-indigo-800', bgHidden: 'bg-indigo-700' },
  '/dashboard/notifications': {
    bg: 'bg-orange-800',
    bgHidden: 'bg-orange-700',
  },
  '/dashboard/sync-queue': { bg: 'bg-teal-800', bgHidden: 'bg-teal-700' },
  '/dashboard/reports': { bg: 'bg-emerald-800', bgHidden: 'bg-emerald-700' },
  '/dashboard/audit-logs': { bg: 'bg-purple-800', bgHidden: 'bg-purple-700' },
  '/dashboard/settings': { bg: 'bg-zinc-800', bgHidden: 'bg-zinc-700' },
  '/dashboard/data-organizer': { bg: 'bg-slate-800', bgHidden: 'bg-slate-700' },
  '/dashboard/calculator': { bg: 'bg-sky-800', bgHidden: 'bg-sky-700' },
  '/dashboard/getting-started': { bg: 'bg-red-900', bgHidden: 'bg-red-800' },
  '/dashboard/faq': { bg: 'bg-orange-900', bgHidden: 'bg-orange-800' },
  '/dashboard/import-guide': { bg: 'bg-cyan-800', bgHidden: 'bg-cyan-700' },
};

function getPageColors(pathname: string): { bg: string; bgHidden: string } {
  if (PAGE_COLORS[pathname]) return PAGE_COLORS[pathname];
  const segments = pathname.split('/');
  while (segments.length > 2) {
    segments.pop();
    const parent = segments.join('/');
    if (PAGE_COLORS[parent]) return PAGE_COLORS[parent];
  }
  return { bg: 'bg-gray-900', bgHidden: 'bg-gray-800' };
}

function getPageTitle(pathname: string, search: string): string {
  if (
    pathname === '/dashboard/inventory' &&
    search.includes('category=replaced')
  ) {
    return 'Retired extinguishers';
  }
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Check for nested routes (e.g. /dashboard/inventory/new → Inventory)
  const segments = pathname.split('/');
  while (segments.length > 2) {
    segments.pop();
    const parent = segments.join('/');
    if (PAGE_TITLES[parent]) return PAGE_TITLES[parent];
  }
  return 'Dashboard';
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(
    () => localStorage.getItem(BANNER_PREF_KEY) === '1',
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { org } = useOrg();
  const isCalculatorPage = location.pathname.endsWith('/calculator');
  const pageTitle = getPageTitle(location.pathname, location.search);
  const pageColors = getPageColors(location.pathname);

  const toggleBanner = useCallback(() => {
    setBannerHidden((prev) => {
      const next = !prev;
      localStorage.setItem(BANNER_PREF_KEY, next ? '1' : '0');
      return next;
    });
  }, []);
  const hasAiAccess = hasFeature(
    org?.featureFlags as unknown as Record<string, boolean> | undefined,
    'aiAssistant',
    org?.plan,
  );

  const isEnterprise = org?.plan === 'enterprise';
  const subStatus = org?.subscriptionStatus ?? null;
  const subscriptionBlocked =
    !isEnterprise && (subStatus === 'canceled' || subStatus === 'unpaid');
  const subscriptionPastDue = !isEnterprise && subStatus === 'past_due';
  // Allow Settings through even when blocked so users can resubscribe
  const isSettingsPage = location.pathname === '/dashboard/settings';
  const blockContent = subscriptionBlocked && !isSettingsPage;

  const trialEndMs =
    org?.trialEnd &&
    typeof org.trialEnd === 'object' &&
    'toMillis' in org.trialEnd &&
    typeof (org.trialEnd as { toMillis: () => number }).toMillis === 'function'
      ? (org.trialEnd as { toMillis: () => number }).toMillis()
      : null;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const msToTrialEnd =
    trialEndMs !== null ? trialEndMs - nowMs : null;
  const trialEndsSoon =
    !isEnterprise &&
    subStatus === 'trialing' &&
    msToTrialEnd !== null &&
    msToTrialEnd > 0 &&
    msToTrialEnd <= 3 * 24 * 60 * 60 * 1000;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Offline / sync status banner */}
        <OfflineBanner />

        {/* Plan-based ad banner (only on publisher content pages) */}
        <DashboardAdBanner />

        {/* Subscription past-due banner — shown on every page */}
        {subscriptionPastDue && (
          <div className="flex shrink-0 items-center gap-3 border-b border-orange-200 bg-orange-50 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" />
            <p className="flex-1 text-sm font-medium text-orange-800">
              Payment past due — please update your payment method to avoid
              losing access.
            </p>
            <button
              onClick={() =>
                navigate(settingsBillingPath(readBillingIntervalPreference()))
              }
              className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
            >
              Manage Billing
            </button>
          </div>
        )}

        {trialEndsSoon && (
          <div className="flex shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
            <Clock className="h-4 w-4 shrink-0 text-amber-700" />
            <p className="flex-1 text-sm font-medium text-amber-900">
              Your Pro trial ends soon — add a payment method in Billing to keep
              full access.
            </p>
            <button
              type="button"
              onClick={() =>
                navigate(settingsBillingPath(readBillingIntervalPreference()))
              }
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
            >
              Billing
            </button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {!isCalculatorPage && !bannerHidden && (
            <div
              className={`relative ${pageColors.bg} transition-colors duration-300`}
            >
              <img
                src="/extinguisherTracker2.png"
                alt="ExtinguisherTracker"
                className="mx-auto block w-[96%] object-contain py-1"
              />
              <div className="absolute inset-0 flex items-end justify-center pb-3 sm:pb-5">
                <h2 className="text-xl font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:text-2xl md:text-3xl">
                  {pageTitle}
                </h2>
              </div>
              <button
                onClick={toggleBanner}
                className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white/80 backdrop-blur hover:bg-black/70 hover:text-white"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                Hide
              </button>
            </div>
          )}
          {!isCalculatorPage && bannerHidden && (
            <div
              className={`flex items-center justify-between ${pageColors.bgHidden} px-6 py-2.5 transition-colors duration-300`}
            >
              <h2 className="text-lg font-bold text-white">{pageTitle}</h2>
              <button
                onClick={toggleBanner}
                className="flex items-center gap-1 rounded-md border border-white/20 px-2 py-1 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Show banner
              </button>
            </div>
          )}
          {!isCalculatorPage && bannerHidden && (
            <AdSlot
              format="banner"
              minTier="minimal"
              className="border-b border-gray-200 bg-gray-50 px-4 py-2"
            />
          )}
          {isCalculatorPage && (
            <div className="border-b border-gray-200 bg-white px-6 py-3">
              <h2 className="text-lg font-bold text-gray-900">{pageTitle}</h2>
            </div>
          )}
          {blockContent ? (
            <div className="flex flex-1 items-center justify-center p-12">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Subscription Ended
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Your subscription is no longer active. Renew your plan to
                  continue using ExtinguisherTracker. Your data is preserved and
                  will be fully accessible once you resubscribe.
                </p>
                <button
                  onClick={() =>
                navigate(settingsBillingPath(readBillingIntervalPreference()))
              }
                  className="mt-6 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Resubscribe
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Global AI assistant for Pro, Elite, and Enterprise */}
        {hasAiAccess && <AiAssistantPanel />}
      </div>
    </div>
  );
}
