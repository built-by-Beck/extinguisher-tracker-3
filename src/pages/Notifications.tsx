/**
 * Notifications page
 * Full list of org notifications with type/severity filters.
 * Route: /dashboard/notifications
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
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
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import {
  subscribeToNotifications,
  markNotificationRead,
} from '../services/notificationService.ts';
import type { Notification, NotificationType, NotificationSeverity } from '../types/notification.ts';

function getNotifIcon(type: NotificationType) {
  switch (type) {
    case 'inspection_due':
      return <Calendar className="h-5 w-5 text-yellow-600" />;
    case 'inspection_overdue':
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    case 'annual_due':
      return <CalendarClock className="h-5 w-5 text-orange-500" />;
    case 'maintenance_due':
      return <Wrench className="h-5 w-5 text-blue-600" />;
    case 'hydro_due':
      return <Droplets className="h-5 w-5 text-cyan-600" />;
    case 'over_limit':
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    case 'system_alert':
      return <Info className="h-5 w-5 text-gray-500" />;
    default:
      return <ShieldCheck className="h-5 w-5 text-gray-400" />;
  }
}

function formatTimestamp(timestamp: unknown): string {
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
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const typeLabels: Record<NotificationType, string> = {
  inspection_due: 'Inspection Due',
  inspection_overdue: 'Inspection Overdue',
  annual_due: 'Annual Due',
  maintenance_due: 'Maintenance Due',
  hydro_due: 'Hydro Test Due',
  over_limit: 'Over Limit',
  system_alert: 'System Alert',
};

const severityBadge: Record<NotificationSeverity, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

const severityLabel: Record<NotificationSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';
  const userId = user?.uid ?? '';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [typeFilter, setTypeFilter] = useState<NotificationType | ''>('');
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | ''>('');
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const unsub = subscribeToNotifications(orgId, setNotifications, { limit: 100 });
    return () => unsub();
  }, [orgId]);

  // Client-side filter
  const filtered = notifications.filter((n) => {
    if (typeFilter && n.type !== typeFilter) return false;
    if (severityFilter && n.severity !== severityFilter) return false;
    return true;
  });

  async function handleMarkRead(notifId: string) {
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

  function handleCardClick(notif: Notification) {
    if (!notif.relatedEntityId || !notif.relatedEntityType) return;
    if (notif.relatedEntityType === 'extinguisher') {
      navigate(`/dashboard/inventory/${notif.relatedEntityId}/edit`);
    } else if (notif.relatedEntityType === 'workspace') {
      navigate(`/dashboard/workspaces/${notif.relatedEntityId}`);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Organization compliance alerts and reminders
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as NotificationType | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All Types</option>
          {(Object.keys(typeLabels) as NotificationType[]).map((t) => (
            <option key={t} value={t}>{typeLabels[t]}</option>
          ))}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as NotificationSeverity | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No notifications</h3>
          <p className="mt-1 text-sm text-gray-500">
            {typeFilter || severityFilter
              ? 'No notifications match the selected filters.'
              : 'Compliance alerts and reminders will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif) => {
            const isUnread = userId ? !notif.readBy.includes(userId) : false;
            const isClickable =
              !!notif.relatedEntityId &&
              !!notif.relatedEntityType &&
              notif.relatedEntityType !== 'org';

            return (
              <div
                key={notif.id}
                className={`flex items-start gap-4 rounded-lg border p-4 shadow-sm transition-colors ${
                  isUnread ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
                } ${isClickable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={isClickable ? () => handleCardClick(notif) : undefined}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {getNotifIcon(notif.type)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{notif.title}</span>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        severityBadge[notif.severity] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {severityLabel[notif.severity] ?? notif.severity}
                    </span>
                    {isUnread && (
                      <span className="inline-block rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{notif.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatTimestamp(notif.createdAt)}</p>
                </div>

                {/* Mark read button */}
                {isUnread && notif.id && userId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkRead(notif.id!);
                    }}
                    disabled={markingRead === notif.id}
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:border-gray-300 hover:text-gray-700 disabled:opacity-50"
                    title="Mark as read"
                  >
                    {markingRead === notif.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3 w-3" />
                    )}
                    Read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
