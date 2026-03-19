/**
 * OfflineContext — manages offline state, pending sync count, and sync operations.
 *
 * Provides:
 * - isOnline / wasOffline from useOnlineStatus
 * - pendingCount: number of queued inspection writes not yet synced
 * - isSyncing: whether a sync operation is in progress
 * - syncError: last sync error message (if any)
 * - forceSync: manually trigger the sync engine
 *
 * Must be rendered inside AuthProvider + OrgProvider so it can access orgId.
 *
 * Author: built_by_Beck
 */

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { getPendingCount, processQueue } from '../services/offlineSyncService.ts';
import { useAuth } from '../hooks/useAuth.ts';

export interface OfflineContextValue {
  isOnline: boolean;
  wasOffline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncError: string | null;
  forceSync: () => Promise<void>;
}

export const OfflineContext = createContext<OfflineContextValue | null>(null);

interface OfflineProviderProps {
  children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Track whether we were previously offline to detect the online transition
  const prevIsOnlineRef = useRef<boolean>(isOnline);

  // Refresh pending count from IndexedDB
  const refreshPendingCount = useCallback(async () => {
    if (!orgId) {
      setPendingCount(0);
      return;
    }
    try {
      const count = await getPendingCount(orgId);
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available; ignore
    }
  }, [orgId]);

  // Run the sync engine
  const forceSync = useCallback(async (): Promise<void> => {
    if (!orgId || !isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      await processQueue(orgId);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [orgId, isOnline, isSyncing, refreshPendingCount]);

  // Auto-sync when coming back online (offline -> online transition)
  useEffect(() => {
    const wasOfflinePrev = !prevIsOnlineRef.current;
    prevIsOnlineRef.current = isOnline;

    if (isOnline && wasOfflinePrev && orgId) {
      forceSync().catch(() => undefined);
    }
  }, [isOnline, orgId, forceSync]);

  // Poll pending count every 5 seconds
  useEffect(() => {
    if (!orgId) return;

    refreshPendingCount().catch(() => undefined);

    const interval = setInterval(() => {
      refreshPendingCount().catch(() => undefined);
    }, 5000);

    return () => clearInterval(interval);
  }, [orgId, refreshPendingCount]);

  const value: OfflineContextValue = {
    isOnline,
    wasOffline,
    pendingCount,
    isSyncing,
    syncError,
    forceSync,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}
