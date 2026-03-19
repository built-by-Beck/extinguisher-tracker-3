/**
 * OfflineBanner — displays connectivity and sync status at the top of the content area.
 *
 * States:
 * - Offline: amber banner with WifiOff icon + pending count
 * - Online + syncing: blue banner with spinning RefreshCw icon
 * - Online + pending (not syncing): amber banner with "Sync Now" button
 * - Online + no pending: renders nothing
 *
 * Author: built_by_Beck
 */

import { WifiOff, RefreshCw } from 'lucide-react';
import { useOffline } from '../../hooks/useOffline.ts';

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, forceSync } = useOffline();

  // Offline
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>
          You are offline. Changes will sync when connection returns.
          {pendingCount > 0 && (
            <span className="ml-1 font-medium">({pendingCount} pending inspection{pendingCount !== 1 ? 's' : ''})</span>
          )}
        </span>
      </div>
    );
  }

  // Online + syncing
  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
        <span>Syncing {pendingCount > 0 ? `${pendingCount} ` : ''}inspection{pendingCount !== 1 ? 's' : ''}...</span>
      </div>
    );
  }

  // Online + pending (not syncing)
  if (pendingCount > 0) {
    return (
      <div className="flex items-center justify-between gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
        <span>
          {pendingCount} inspection{pendingCount !== 1 ? 's' : ''} pending sync.
        </span>
        <button
          onClick={() => void forceSync()}
          className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
        >
          Sync Now
        </button>
      </div>
    );
  }

  // Online + no pending — render nothing
  return null;
}
