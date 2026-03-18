/**
 * Audit log service for EX3.
 * Provides cursor-based pagination for browsing org audit logs.
 * Admin-only in the UI; Firestore rules enforce owner/admin read access.
 *
 * Author: built_by_Beck
 */

import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  where,
  startAfter,
  getDocs,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { AuditLog } from '../types/auditLog.ts';

export interface AuditLogPageResult {
  logs: AuditLog[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export interface AuditLogPageOptions {
  limit: number;
  startAfterDoc?: DocumentSnapshot;
  entityType?: string;
}

/**
 * Fetches a page of audit log entries for an org.
 * Ordered by performedAt descending. Supports optional entityType filter and cursor pagination.
 */
export async function getAuditLogPage(
  orgId: string,
  options: AuditLogPageOptions,
): Promise<AuditLogPageResult> {
  const logsRef = collection(doc(db, 'org', orgId), 'auditLogs');

  // Fetch limit+1 to determine whether there are more pages
  const fetchLimit = options.limit + 1;

  const constraints: QueryConstraint[] = [orderBy('performedAt', 'desc'), limit(fetchLimit)];

  if (options.entityType && options.entityType !== 'all') {
    constraints.unshift(where('entityType', '==', options.entityType));
  }

  if (options.startAfterDoc) {
    constraints.push(startAfter(options.startAfterDoc));
  }

  const q = query(logsRef, ...constraints);
  const snap = await getDocs(q);

  const hasMore = snap.docs.length > options.limit;
  const docs = hasMore ? snap.docs.slice(0, options.limit) : snap.docs;

  const logs: AuditLog[] = docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      action: data.action ?? '',
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      details: data.details ?? {},
      performedBy: data.performedBy ?? '',
      performedByEmail: data.performedByEmail ?? null,
      // Prefer performedAt; fall back to createdAt for backward compat with older docs
      performedAt: data.performedAt ?? data.createdAt ?? null,
      createdAt: data.createdAt ?? null,
    } as AuditLog;
  });

  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

  return { logs, lastDoc, hasMore };
}
