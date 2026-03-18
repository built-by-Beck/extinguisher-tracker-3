/**
 * Audit log types for EX3.
 * Matches the Firestore schema in org/{orgId}/auditLogs/{logId}.
 *
 * Author: built_by_Beck
 */

export type AuditLogAction =
  | 'member.invited'
  | 'member.joined'
  | 'member.removed'
  | 'member.role_changed'
  | 'extinguisher.created'
  | 'extinguisher.updated'
  | 'extinguisher.deleted'
  | 'extinguisher.replaced'
  | 'extinguisher.retired'
  | 'extinguisher.imported'
  | 'workspace.created'
  | 'workspace.archived'
  | 'settings.updated'
  | 'billing.checkout_started'
  | 'billing.subscription_created'
  | 'billing.subscription_updated'
  | 'billing.subscription_canceled'
  | 'billing.payment_failed'
  | 'data.exported'
  | 'data.imported'
  | 'tag.generated'
  | 'tag.printed'
  | 'report.generated'
  | 'org.created';

export interface AuditLog {
  id: string;
  action: AuditLogAction | string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
  performedBy: string;
  performedByEmail: string | null;
  /** Primary timestamp field (spec-required). May be null on older documents. */
  performedAt: unknown;
  /** Legacy timestamp field written for backward compatibility. */
  createdAt: unknown;
}
