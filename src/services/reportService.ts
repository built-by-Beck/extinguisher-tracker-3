/**
 * Report service for ExtinguisherTracker.
 * Provides read access to workspace compliance reports and triggers on-demand report generation.
 *
 * Author: built_by_Beck
 */

import {
  doc,
  collection,
  query,
  orderBy,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';
import type { Report, ReportFormat, ReportGenerationOptions } from '../types/report.ts';

function reportsRef(orgId: string) {
  return collection(db, 'org', orgId, 'reports');
}

/**
 * Fetches a single report document by workspaceId (report doc ID = workspaceId).
 * Returns null if the document does not exist.
 */
export async function getReport(orgId: string, workspaceId: string): Promise<Report | null> {
  const docRef = doc(db, 'org', orgId, 'reports', workspaceId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Report, 'id'>) };
}

/**
 * Subscribes to all reports for an org, ordered by archivedAt descending.
 * Returns an unsubscribe function.
 */
export function subscribeToReports(
  orgId: string,
  callback: (reports: Report[]) => void,
): Unsubscribe {
  const q = query(reportsRef(orgId), orderBy('archivedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const items: Report[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Report, 'id'>),
    }));
    callback(items);
  });
}

/**
 * Calls the generateReport Cloud Function to generate (or re-sign) a download URL
 * for the given workspace report in the requested format.
 */
export async function generateReportDownload(
  orgId: string,
  workspaceId: string,
  format: ReportFormat,
  options?: ReportGenerationOptions,
): Promise<{ downloadUrl: string }> {
  const fn = httpsCallable<
    { orgId: string; workspaceId: string; format: ReportFormat; options?: ReportGenerationOptions },
    { downloadUrl: string; reportId: string }
  >(functions, 'generateReport');

  const result = await fn({ orgId, workspaceId, format, options });
  return { downloadUrl: result.data.downloadUrl };
}
