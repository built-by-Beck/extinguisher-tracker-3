/**
 * useGuest — access GuestContext values.
 * Must be used within a GuestProvider.
 *
 * Author: built_by_Beck
 */

import { useContext } from 'react';
import { GuestContext, type GuestContextValue } from '../contexts/GuestContext.tsx';

export function useGuest(): GuestContextValue {
  const ctx = useContext(GuestContext);
  if (!ctx) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return ctx;
}
