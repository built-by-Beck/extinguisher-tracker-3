import { adminDb } from './admin.js';
import { FieldValue } from 'firebase-admin/firestore';

interface AuditLogEntry {
  action: string;
  performedBy: string;
  performedByEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Writes an audit log entry to org/{orgId}/auditLogs.
 * Audit logs are append-only — never update or delete.
 *
 * Writes both `performedAt` (spec-required) and `createdAt` (backward compat).
 */
export async function writeAuditLog(orgId: string, entry: AuditLogEntry): Promise<void> {
  const logsRef = adminDb.collection(`org/${orgId}/auditLogs`);
  const ts = FieldValue.serverTimestamp();
  await logsRef.add({
    action: entry.action,
    performedBy: entry.performedBy,
    performedByEmail: entry.performedByEmail ?? null,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    details: entry.details ?? {},
    performedAt: ts,
    createdAt: ts,
  });
}
