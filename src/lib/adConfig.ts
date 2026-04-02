/**
 * Ad tier configuration per plan.
 *
 * Tiers control how many ads a user sees:
 *   - heavy:   banner + sidebar + in-content (Basic plan)
 *   - light:   sidebar or small banner only (Pro plan)
 *   - minimal: small footer banner only (Elite & Enterprise)
 *   - none:    no ads at all (reserved for future use)
 *
 * Public/marketing pages always show ads regardless of plan.
 *
 * IMPORTANT: Ads must NOT appear on pages without publisher content
 * (login, signup, settings, billing, members, invite, create-org, QR landing).
 */

export type AdTier = 'none' | 'minimal' | 'light' | 'heavy';

const PLAN_AD_TIERS: Record<string, AdTier> = {
  basic: 'heavy',
  pro: 'light',
  elite: 'minimal',
  enterprise: 'minimal',
};

/**
 * Get the ad tier for a given plan.
 * Unknown/missing plan defaults to 'heavy' (most ads — treat as free-tier).
 */
export function getAdTier(plan?: string | null): AdTier {
  if (!plan) return 'heavy';
  return PLAN_AD_TIERS[plan] ?? 'heavy';
}

/**
 * Dashboard pages where ads are allowed (publisher content pages).
 * Any route NOT in this list will NOT show ads.
 *
 * These are path segments that match against the current route within /dashboard/*.
 */
export const AD_ALLOWED_DASHBOARD_PAGES = new Set([
  '',           // dashboard index
  'inventory',
  'locations',
  'workspaces',
  'reports',
  'calculator',
  'audit-logs',
  'notifications',
  'import-guide',
]);

/**
 * Dashboard pages where ads are NEVER allowed (no publisher content).
 */
export const AD_BLOCKED_DASHBOARD_PAGES = new Set([
  'settings',
  'members',
  'data-organizer',
  'sync-queue',
  'inventory/new',
  'inventory/print',
  'inventory/print-tags',
]);
