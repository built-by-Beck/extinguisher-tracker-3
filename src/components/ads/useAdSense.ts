import { useEffect } from 'react';

const ADSENSE_PUB_ID = import.meta.env.VITE_ADSENSE_PUB_ID as string | undefined;

let scriptLoaded = false;

/**
 * Loads the AdSense script once globally.
 * No-ops if VITE_ADSENSE_PUB_ID is not set.
 */
export function useAdSenseScript() {
  useEffect(() => {
    if (scriptLoaded || !ADSENSE_PUB_ID) return;
    scriptLoaded = true;

    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }, []);
}

export function getAdSensePubId(): string | undefined {
  return ADSENSE_PUB_ID;
}
