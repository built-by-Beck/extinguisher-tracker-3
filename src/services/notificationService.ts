/**
 * Notification service for EX3.
 * Provides real-time subscription and read-state management for org notifications.
 * Notifications are backend-write-only; markAsRead goes through a Cloud Function.
 *
 * Author: built_by_Beck
 */

import {
  collection,
  query,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';
import type { Notification } from '../types/notification.ts';

function notificationsRef(orgId: string) {
  return collection(db, 'org', orgId, 'notifications');
}

/**
 * Subscribe to real-time org notifications, ordered by createdAt descending.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  orgId: string,
  callback: (notifications: Notification[]) => void,
  options?: { limit?: number },
): Unsubscribe {
  const maxItems = options?.limit ?? 50;
  const q = query(
    notificationsRef(orgId),
    orderBy('createdAt', 'desc'),
    fbLimit(maxItems),
  );

  return onSnapshot(q, (snap) => {
    const items: Notification[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Notification, 'id'>),
    }));
    callback(items);
  });
}

/**
 * Returns the count of notifications that the given userId has NOT read.
 * Uses client-side filtering since Firestore doesn't support array-not-contains.
 */
export function getUnreadCount(notifications: Notification[], userId: string): number {
  return notifications.filter((n) => !n.readBy.includes(userId)).length;
}

/**
 * Marks a notification as read for the current user.
 * Calls the markNotificationRead Cloud Function (security rules block direct client writes).
 */
export async function markNotificationRead(orgId: string, notificationId: string): Promise<void> {
  const fn = httpsCallable(functions, 'markNotificationRead');
  await fn({ orgId, notificationId });
}
