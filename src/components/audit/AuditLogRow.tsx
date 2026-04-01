/**
 * AuditLogRow — renders a single audit log entry.
 * Shows action label, performer, relative timestamp, entity type badge,
 * and an expandable details section.
 *
 * Author: built_by_Beck
 */

import { createElement, useState } from 'react';
import {
  Users,
  Package,
  ClipboardList,
  CreditCard,
  Download,
  Tag,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AuditLog } from '../../types/auditLog.ts';

// Human-readable action labels
const ACTION_LABELS: Record<string, string> = {
  'member.invited': 'Member Invited',
  'member.joined': 'Member Joined',
  'member.removed': 'Member Removed',
  'member.role_changed': 'Role Changed',
  'extinguisher.created': 'Extinguisher Created',
  'extinguisher.updated': 'Extinguisher Updated',
  'extinguisher.deleted': 'Extinguisher Deleted',
  'extinguisher.replaced': 'Extinguisher Replaced',
  'extinguisher.retired': 'Extinguisher Retired',
  'extinguisher.imported': 'Extinguishers Imported',
  'workspace.created': 'Workspace Created',
  'workspace.archived': 'Workspace Archived',
  'settings.updated': 'Settings Updated',
  'billing.checkout_started': 'Checkout Started',
  'billing.subscription_created': 'Subscription Created',
  'billing.subscription_updated': 'Subscription Updated',
  'billing.subscription_canceled': 'Subscription Canceled',
  'billing.payment_failed': 'Payment Failed',
  'data.exported': 'Data Exported',
  'data.imported': 'Data Imported',
  'tag.generated': 'Tag Generated',
  'tag.printed': 'Tag Printed',
  'report.generated': 'Report Generated',
  'org.created': 'Organization Created',
};

// Entity type badge colors
const ENTITY_TYPE_BADGE: Record<string, string> = {
  member: 'bg-blue-100 text-blue-700',
  extinguisher: 'bg-orange-100 text-orange-700',
  workspace: 'bg-green-100 text-green-700',
  billing: 'bg-blue-100 text-blue-700',
  data: 'bg-gray-100 text-gray-600',
  tag: 'bg-yellow-100 text-yellow-700',
  report: 'bg-teal-100 text-teal-700',
  org: 'bg-red-100 text-red-700',
};

// Entity type icons
const ENTITY_TYPE_ICON: Record<string, typeof FileText> = {
  member: Users,
  extinguisher: Package,
  workspace: ClipboardList,
  billing: CreditCard,
  data: Download,
  tag: Tag,
  report: FileText,
};

function getEntityTypeIcon(entityType: string | null) {
  if (!entityType) return FileText;
  return ENTITY_TYPE_ICON[entityType] ?? FileText;
}

function getEntityTypeBadgeClass(entityType: string | null): string {
  if (!entityType) return 'bg-gray-100 text-gray-600';
  return ENTITY_TYPE_BADGE[entityType] ?? 'bg-gray-100 text-gray-600';
}

/**
 * Returns a relative time string (e.g. "2 hours ago", "3 days ago").
 */
function formatRelativeTime(timestamp: unknown): string {
  if (!timestamp) return '--';
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
      return '--';
    }

    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    // Fall back to formatted date for older entries
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '--';
  }
}

interface AuditLogRowProps {
  log: AuditLog;
}

export function AuditLogRow({ log }: AuditLogRowProps) {
  const [expanded, setExpanded] = useState(false);

  const actionLabel = ACTION_LABELS[log.action] ?? log.action;
  const performerDisplay = log.performedByEmail ?? `${log.performedBy.slice(0, 8)}...`;
  const timestamp = log.performedAt ?? log.createdAt;
  const badgeClass = getEntityTypeBadgeClass(log.entityType);
  const detailEntries = Object.entries(log.details ?? {});

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Entity type icon */}
        <div className="mt-0.5 shrink-0">
          {createElement(getEntityTypeIcon(log.entityType), {
            className: 'h-5 w-5 text-gray-400',
          })}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Action label */}
            <span className="text-sm font-semibold text-gray-900">{actionLabel}</span>

            {/* Entity type badge */}
            {log.entityType && (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
              >
                {log.entityType}
              </span>
            )}
          </div>

          {/* Performer + timestamp */}
          <p className="mt-0.5 text-xs text-gray-500">
            By <span className="font-medium text-gray-700">{performerDisplay}</span>
            {' · '}
            <span title={String(timestamp)}>{formatRelativeTime(timestamp)}</span>
          </p>

          {/* Expandable details */}
          {detailEntries.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {expanded ? 'Hide details' : 'Show details'}
              </button>

              {expanded && (
                <div className="mt-2 rounded-md bg-gray-50 p-3 text-xs">
                  <dl className="space-y-1">
                    {detailEntries.map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="shrink-0 font-medium text-gray-500">{key}:</dt>
                        <dd className="text-gray-700 break-all">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
