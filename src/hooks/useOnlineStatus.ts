/**
 * Hook to detect online/offline network status.
 *
 * - isOnline: current network status based on navigator.onLine + events
 * - wasOffline: true if the app went offline at any point during the session
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [wasOffline, setWasOffline] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
      setWasOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
