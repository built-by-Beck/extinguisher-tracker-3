/**
 * Live launch-promo spots remaining — reads public/launchPromo from Firestore.
 *
 * Author: built_by_Beck
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import {
  LAUNCH_PROMO_ENABLED,
  LAUNCH_PROMO_MAX_CUSTOMERS,
} from '../lib/billingConfig.ts';

export type LaunchPromoSpots = {
  spotsRemaining: number;
  redeemedCount: number;
  maxCustomers: number;
  soldOut: boolean;
  loading: boolean;
};

export function useLaunchPromoSpots(): LaunchPromoSpots | null {
  const [state, setState] = useState<LaunchPromoSpots>({
    spotsRemaining: LAUNCH_PROMO_MAX_CUSTOMERS,
    redeemedCount: 0,
    maxCustomers: LAUNCH_PROMO_MAX_CUSTOMERS,
    soldOut: false,
    loading: true,
  });

  useEffect(() => {
    if (!LAUNCH_PROMO_ENABLED) {
      return;
    }

    const ref = doc(db, 'public', 'launchPromo');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const maxCustomers =
          Number(snap.data()?.maxCustomers) || LAUNCH_PROMO_MAX_CUSTOMERS;
        const redeemedCount = Number(snap.data()?.redeemedCount) || 0;
        const spotsRemaining = Math.max(0, maxCustomers - redeemedCount);

        setState({
          spotsRemaining,
          redeemedCount,
          maxCustomers,
          soldOut: spotsRemaining <= 0,
          loading: false,
        });
      },
      () => {
        setState((prev) => ({ ...prev, loading: false }));
      },
    );

    return unsubscribe;
  }, []);

  if (!LAUNCH_PROMO_ENABLED) {
    return null;
  }

  return state;
}
