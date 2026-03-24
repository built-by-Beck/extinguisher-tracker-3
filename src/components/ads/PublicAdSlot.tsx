import { useEffect, useRef } from 'react';
import { getAdSensePubId } from './useAdSense.ts';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

type PublicAdFormat = 'banner' | 'sidebar' | 'in-content';

interface PublicAdSlotProps {
  format: PublicAdFormat;
  className?: string;
}

const FORMAT_STYLES: Record<PublicAdFormat, string> = {
  banner: 'w-full min-h-[90px] flex items-center justify-center',
  sidebar: 'w-full min-h-[250px] flex items-center justify-center',
  'in-content': 'w-full min-h-[120px] flex items-center justify-center my-4',
};

/**
 * Ad slot for public/marketing pages — no org context needed.
 * Always renders if VITE_ADSENSE_PUB_ID is set (public pages always show ads).
 */
export function PublicAdSlot({ format, className = '' }: PublicAdSlotProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const pubId = getAdSensePubId();

  useEffect(() => {
    if (!pubId || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not ready yet
    }
  }, [pubId]);

  if (!pubId) return null;

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
