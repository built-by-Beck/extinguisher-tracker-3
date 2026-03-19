/**
 * SyncStatusIndicator — small sidebar footer status indicator.
 *
 * Shows connectivity and pending sync count:
 * - Online, no pending: green dot + "Online"
 * - Online, pending: amber dot + "X pending"
 * - Offline: red dot + "Offline"
 *
 * Author: built_by_Beck
 */

import { useOffline } from '../../hooks/useOffline.ts';

export function SyncStatusIndicator() {
  const { isOnline, pendingCount } = useOffline();

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
        Offline
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
        {pendingCount} pending
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
      Online
    </div>
  );
}
