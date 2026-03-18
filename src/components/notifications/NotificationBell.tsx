/**
 * NotificationBell
 * Bell icon with unread count badge. Clicking opens a dropdown with recent notifications.
 * Each notification shows type icon, title, message, relative timestamp.
 * Unread notifications are highlighted.
 * "Mark as read" action per notification.
 * "View all" link navigates to the Notifications page.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  CalendarClock,
  Wrench,
  Droplets,
  AlertTriangle,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.ts';
import {
  subscribeToNotifications,
  getUnreadCount,
  markNotificationRead,
} from '../../services/notificationService.ts';
import type { Notification, NotificationType } from '../../types/notification.ts';

interface NotificationBellProps {
  orgId: string;
}

function getNotifIcon(type: NotificationType) {
  switch (type) {
    case 'inspection_due':
      return <Calendar className="h-4 w-4 text-yellow-600" />;
    case 'inspection_overdue':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'annual_due':
      return <CalendarClock className="h-4 w-4 text-orange-500" />;
    case 'maintenance_due':
      return <Wrench className="h-4 w-4 text-blue-600" />;
    case 'hydro_due':
      return <Droplets className="h-4 w-4 text-cyan-600" />;
    case 'over_limit':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'system_alert':
      return <Info className="h-4 w-4 text-gray-500" />;
    default:
      return <ShieldCheck className="h-4 w-4 text-gray-400" />;
  }
}

function formatRelativeTime(timestamp: unknown): string {
  if (!timestamp) return '';
  try {
    let date: Date;
    if (
      typeof timestamp === 'object' &&
      timestamp !== null &&
      'toDate' in timestamp &&
      typeof (timestamp as { toDate: () => Date }).toDate === 'function'
    ) {
      date = (timestamp as { toDate: () => Date }).toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '';
    }

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const severityBg = {
  info: 'bg-blue-50',
  warning: 'bg-yellow-50',
  critical: 'bg-red-50',
};

export function NotificationBell({ orgId }: NotificationBellProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real-time notifications (last 20)
  useEffect(() => {
    if (!orgId) return;
    const unsub = subscribeToNotifications(orgId, setNotifications, { limit: 20 });
    return () => unsub();
  }, [orgId]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  const unreadCount = user ? getUnreadCount(notifications, user.uid) : 0;
  const recentNotifs = notifications.slice(0, 10);

  async function handleMarkRead(e: React.MouseEvent, notifId: string) {
    e.stopPropagation();
    if (!notifId) return;
    setMarkingRead(notifId);
    try {
      await markNotificationRead(orgId, notifId);
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    } finally {
      setMarkingRead(null);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {recentNotifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              recentNotifs.map((notif) => {
                const isUnread = user ? !notif.readBy.includes(user.uid) : false;
                const bgClass = isUnread
                  ? (severityBg[notif.severity] ?? 'bg-gray-50')
                  : 'bg-white';

                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 border-b border-gray-50 px-4 py-3 last:border-b-0 ${bgClass} ${
                      isUnread ? 'font-medium' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 shrink-0">
                      {getNotifIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 leading-snug">{notif.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500 leading-snug line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatRelativeTime(notif.createdAt)}
                      </p>
                    </div>

                    {/* Mark read */}
                    {isUnread && notif.id && (
                      <button
                        onClick={(e) => handleMarkRead(e, notif.id!)}
                        disabled={markingRead === notif.id}
                        className="shrink-0 rounded p-0.5 text-gray-300 hover:text-gray-500"
                        title="Mark as read"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/dashboard/notifications');
              }}
              className="w-full text-center text-sm font-medium text-red-600 hover:text-red-700"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
