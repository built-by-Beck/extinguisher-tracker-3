/**
 * Report types for EX3.
 * Matches the Firestore schema in org/{orgId}/reports/{reportId}.
 *
 * Author: built_by_Beck
 */

export type ReportFormat = 'csv' | 'pdf' | 'json';

export interface ReportResult {
  assetId: string;
  section: string;
  status: string;
  inspectedAt: unknown;
  inspectedBy: string | null;
  inspectedByEmail: string | null;
  notes: string;
  checklistData: Record<string, string> | null;
}

export interface Report {
  id: string;
  workspaceId: string;
  monthYear: string;
  label: string;
  archivedAt: unknown;
  archivedBy: string;
  totalExtinguishers: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  results: ReportResult[];
  csvDownloadUrl: string | null;
  csvFilePath: string | null;
  pdfDownloadUrl: string | null;
  pdfFilePath: string | null;
  jsonDownloadUrl: string | null;
  jsonFilePath: string | null;
  generatedAt: unknown | null;
}
