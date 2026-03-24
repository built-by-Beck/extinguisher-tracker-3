import { useLocation } from 'react-router-dom';
import { AdSlot } from './AdSlot.tsx';
import { AD_ALLOWED_DASHBOARD_PAGES } from '../../lib/adConfig.ts';

/**
 * Renders a banner ad at the top of dashboard pages — but ONLY on
 * pages that have publisher content. Automatically checks the current
 * route against the allowed list.
 */
export function DashboardAdBanner() {
  const { pathname } = useLocation();

  // Extract the dashboard sub-path: "/dashboard/inventory" → "inventory"
  const subPath = pathname.replace(/^\/dashboard\/?/, '').split('/')[0];

  // Only show ads on allowed pages
  if (!AD_ALLOWED_DASHBOARD_PAGES.has(subPath)) return null;

  return (
    <AdSlot
      format="banner"
      minTier="minimal"
      className="border-b border-gray-200 bg-white px-4 py-2"
    />
  );
}
