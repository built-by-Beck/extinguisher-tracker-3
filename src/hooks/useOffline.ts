/**
 * Hook to consume OfflineContext.
 * Must be used inside OfflineProvider.
 *
 * Author: built_by_Beck
 */

import { useContext } from 'react';
import { OfflineContext, type OfflineContextValue } from '../contexts/OfflineContext.tsx';

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return ctx;
}
