import { adminDb } from './admin.js';
import { FieldValue } from 'firebase-admin/firestore';

interface AuditLogEntry {
  action: string;
  performedBy: string;
  details?: Record<string, unknown>;
}

/**
 * Writes an audit log entry to org/{orgId}/auditLogs.
 * Audit logs are append-only — never update or delete.
 */
export async function writeAuditLog(orgId: string, entry: AuditLogEntry): Promise<void> {
  const logsRef = adminDb.collection(`org/${orgId}/auditLogs`);
  await logsRef.add({
    action: entry.action,
    performedBy: entry.performedBy,
    details: entry.details ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}
