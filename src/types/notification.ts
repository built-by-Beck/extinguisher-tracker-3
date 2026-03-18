/**
 * Notification types for EX3.
 * Matches the schema in BUILD-SPECS/03 and BUILD-SPECS/20.
 *
 * Author: built_by_Beck
 */

export type NotificationType =
  | 'inspection_due'
  | 'inspection_overdue'
  | 'annual_due'
  | 'maintenance_due'
  | 'hydro_due'
  | 'over_limit'
  | 'system_alert';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

/** Matches the Firestore notification document under org/{orgId}/notifications/{notifId} */
export interface Notification {
  id?: string;
  /** Notification type (determines icon/routing) */
  type: NotificationType;
  /** Short title, e.g. "Monthly Inspection Due" */
  title: string;
  /** Detailed message, e.g. "3 extinguishers are due for monthly inspection this week." */
  message: string;
  /** Severity level for color coding */
  severity: NotificationSeverity;
  /**
   * YYYY-MM string identifying the month/period this notification belongs to.
   * Used for deduplication — one notification per type+dueMonth+relatedEntityId.
   */
  dueMonth: string;
  /** Related entity type for navigation */
  relatedEntityType: 'extinguisher' | 'workspace' | 'org' | null;
  /** Related entity ID for navigation */
  relatedEntityId: string | null;
  /** When the notification was sent (scheduled function run time) */
  sentAt: unknown;
  /** When the notification document was created */
  createdAt: unknown;
  /** Array of user UIDs who have read this notification */
  readBy: string[];
}
