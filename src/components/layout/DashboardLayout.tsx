import { useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';
import { OfflineBanner } from '../offline/OfflineBanner.tsx';
import { AiAssistantPanel } from '../ai/AiAssistantPanel.tsx';
import { DashboardAdBanner } from '../ads/DashboardAdBanner.tsx';
import { AdSlot } from '../ads/AdSlot.tsx';
import { useOrg } from '../../hooks/useOrg.ts';
import { hasFeature } from '../../lib/planConfig.ts';

const BANNER_PREF_KEY = 'ex3-hide-banner';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/inventory': 'Inventory',
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
  '/dashboard/import-guide': 'Import Guide',
};

function getPageTitle(pathname: string): string {
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
  const [bannerHidden, setBannerHidden] = useState(() => localStorage.getItem(BANNER_PREF_KEY) === '1');
  const location = useLocation();
  const { org } = useOrg();
  const isCalculatorPage = location.pathname.endsWith('/calculator');
  const pageTitle = getPageTitle(location.pathname);

  const toggleBanner = useCallback(() => {
    setBannerHidden((prev) => {
      const next = !prev;
      localStorage.setItem(BANNER_PREF_KEY, next ? '1' : '0');
      return next;
    });
  }, []);
  const hasAiAccess = org?.featureFlags ? hasFeature(
    org.featureFlags as unknown as Record<string, boolean>,
    'aiAssistant',
    org.plan
  ) : false;

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

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {!isCalculatorPage && !bannerHidden && (
            <div className="relative bg-gray-900">
              <img
                src="/extinguisherTracker2.png"
                alt="Extinguisher Tracker"
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
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-2.5">
              <h2 className="text-lg font-bold text-gray-900">{pageTitle}</h2>
              <button
                onClick={toggleBanner}
                className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
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
          <Outlet />
        </main>

        {/* Global AI assistant for Pro, Elite, and Enterprise */}
        {hasAiAccess && <AiAssistantPanel />}
      </div>
    </div>
  );
}
