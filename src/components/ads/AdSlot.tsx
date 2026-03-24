import { useEffect, useRef } from 'react';
import { getAdSensePubId } from './useAdSense.ts';
import { useOrg } from '../../hooks/useOrg.ts';
import { getAdTier, type AdTier } from '../../lib/adConfig.ts';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export type AdFormat = 'banner' | 'sidebar' | 'in-content';

interface AdSlotProps {
  /** Which format this ad is — determines size and responsive behavior */
  format: AdFormat;
  /** Minimum ad tier required to show this slot. Ads only render if user's tier >= this level. */
  minTier?: AdTier;
  /** Override: force a specific tier (for public/marketing pages with no org context) */
  forceTier?: AdTier;
  /** Extra CSS classes on the wrapper */
  className?: string;
}

/** Maps ad tiers to a numeric level for comparison */
const TIER_LEVEL: Record<AdTier, number> = {
  none: 0,
  minimal: 1,
  light: 2,
  heavy: 3,
};

const FORMAT_STYLES: Record<AdFormat, string> = {
  banner: 'w-full min-h-[90px] flex items-center justify-center',
  sidebar: 'w-full min-h-[250px] flex items-center justify-center',
  'in-content': 'w-full min-h-[120px] flex items-center justify-center my-4',
};

/**
 * Renders a Google AdSense ad unit.
 *
 * - No-ops entirely if VITE_ADSENSE_PUB_ID is not set.
 * - Checks the user's plan to determine ad tier.
 * - Only renders if the user's ad tier meets the minTier for this slot.
 */
export function AdSlot({ format, minTier = 'minimal', forceTier, className = '' }: AdSlotProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const pubId = getAdSensePubId();
  const { org } = useOrg();

  const tier = forceTier ?? getAdTier(org?.plan);
  const tierLevel = TIER_LEVEL[tier];
  const requiredLevel = TIER_LEVEL[minTier];

  useEffect(() => {
    if (!pubId || tierLevel < requiredLevel || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not ready yet — ignore
    }
  }, [pubId, tierLevel, requiredLevel]);

  // Don't render anything if no pub ID or tier too low
  if (!pubId || tierLevel < requiredLevel) return null;

  return (
    <div className={`ad-slot ad-slot-${format} print:hidden ${FORMAT_STYLES[format]} ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={pubId}
        data-ad-format={format === 'sidebar' ? 'rectangle' : 'auto'}
        data-full-width-responsive={format !== 'sidebar' ? 'true' : 'false'}
      />
    </div>
  );
}
