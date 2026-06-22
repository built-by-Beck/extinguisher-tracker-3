import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  billingIntervalFromSearchParams,
  readBillingIntervalPreference,
  writeBillingIntervalPreference,
  type BillingIntervalPreference,
} from '../lib/billingIntervalPreference.ts';

/**
 * Shared monthly/yearly toggle state (URL param → localStorage → default year).
 */
export function useBillingIntervalPreference() {
  const [searchParams] = useSearchParams();
  const [interval, setIntervalState] = useState<BillingIntervalPreference>(
    () => {
      const fromUrl = billingIntervalFromSearchParams(searchParams);
      if (fromUrl) return fromUrl;
      return readBillingIntervalPreference();
    },
  );

  useEffect(() => {
    const fromUrl = billingIntervalFromSearchParams(searchParams);
    if (fromUrl) {
      setIntervalState(fromUrl);
      writeBillingIntervalPreference(fromUrl);
    }
  }, [searchParams]);

  const setInterval = useCallback((next: BillingIntervalPreference) => {
    setIntervalState(next);
    writeBillingIntervalPreference(next);
  }, []);

  return { interval, setInterval };
}
