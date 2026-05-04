/**
 * generateReport — Callable Cloud Function
 * Generates CSV, PDF, or JSON report files for a given archived workspace.
 * Files are stored in Firebase Storage; Firestore report doc is updated with paths + signed URLs.
 * Idempotent: re-calling with the same format re-signs a fresh URL from the stored file path.
 *
 * Input: { orgId: string; workspaceId: string; format: 'csv' | 'pdf' | 'json' }
 * Returns: { downloadUrl: string; reportId: string }
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwNotFound } from '../utils/errors.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { generateInspectionReportPDF } from './pdfGenerator.js';
import type { ReportResultRow } from './pdfGenerator.js';
import { enrichFinderFields, hasFinderFields } from './finderFields.js';

type ReportFormat = 'csv' | 'pdf' | 'json';

function isValidFormat(f: unknown): f is ReportFormat {
  return f === 'csv' || f === 'pdf' || f === 'json';
}

function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function timestampToString(ts: unknown): string {
  if (!ts) return '';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (ts instanceof Date) {
    return ts.toISOString();
  }
  return '';
}

function debugReportLog(hypothesisId: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7842/ingest/21545bb1-6e23-40cd-ab67-ad19a1e5e25c', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd3826d' },
    body: JSON.stringify({
      sessionId: 'd3826d',
      runId: 'initial-report-generation',
      hypothesisId,
      location: 'functions/src/reports/generateReport.ts',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

interface ReportDocData {
  workspaceId: string;
  monthYear: string;
  label: string;
  results: ReportResultFirestore[];
  totalExtinguishers: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  csvFilePath: string | null;
  pdfFilePath: string | null;
  jsonFilePath: string | null;
  csvDownloadUrl: string | null;
  pdfDownloadUrl: string | null;
  jsonDownloadUrl: string | null;
}

interface ReportResultFirestore {
  extinguisherId: string;
  assetId: string;
  serial: string;
  parentLocation: string;
  locationName: string;
  section: string;
  vicinity: string;
  status: string;
  inspectedAt: unknown;
  inspectedBy: string | null;
  inspectedByEmail: string | null;
  notes: string;
  checklistData: Record<string, string> | null;
}

async function buildReportResultsFromInspections(orgId: string, workspaceId: string) {
  const inspSnap = await adminDb
    .collection(`org/${orgId}/inspections`)
    .where('workspaceId', '==', workspaceId)
    .get();

  let passed = 0;
  let failed = 0;
  let pending = 0;
  const results: ReportResultFirestore[] = [];

  inspSnap.forEach((d) => {
    const data = d.data();
    const status = data.status as string;
    if (status === 'pass') passed++;
    else if (status === 'fail') failed++;
    else pending++;

    results.push({
      extinguisherId: data.extinguisherId ?? '',
      assetId: data.assetId ?? '',
      serial: data.serial ?? '',
      parentLocation: data.parentLocation ?? '',
      locationName: data.locationName ?? '',
      section: data.section ?? '',
      vicinity: data.vicinity ?? '',
      status: data.status ?? 'pending',
      inspectedAt: data.inspectedAt ?? null,
      inspectedBy: data.inspectedBy ?? null,
      inspectedByEmail: data.inspectedByEmail ?? null,
      notes: data.notes ?? '',
      checklistData: data.checklistData ?? null,
    });
  });

  return {
    totalExtinguishers: inspSnap.size,
    passedCount: passed,
    failedCount: failed,
    pendingCount: pending,
    results: await enrichFinderFields(orgId, results),
  };
}

export const generateReport = onCall(async (request) => {
  try {
  const { uid } = validateAuth(request);
  const { orgId, workspaceId, format } = request.data as {
    orgId: string;
    workspaceId: string;
    format: unknown;
  };

  if (!orgId || typeof orgId !== 'string') throwInvalidArgument('orgId is required.');
  if (!workspaceId || typeof workspaceId !== 'string') throwInvalidArgument('workspaceId is required.');
  if (!isValidFormat(format)) throwInvalidArgument('format must be one of: csv, pdf, json.');

  // #region agent log
  debugReportLog('H1,H2,H3,H4', 'generateReport request validated', {
    format,
    workspaceIdPresent: Boolean(workspaceId),
  });
  // #endregion

  // Any active member can generate/download reports
  const member = await validateMembership(orgId, uid, ['owner', 'admin', 'inspector', 'viewer']);

  // 1. Load workspace
  const wsRef = adminDb.doc(`org/${orgId}/workspaces/${workspaceId}`);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) throwNotFound('Workspace not found.');
  const wsData = wsSnap.data()!;

  // 2. Load or create report doc
  const reportRef = adminDb.doc(`org/${orgId}/reports/${workspaceId}`);
  let reportSnap = await reportRef.get();

  // #region agent log
  debugReportLog('H1,H2', 'workspace and report snapshots loaded', {
    workspaceStatus: wsData.status ?? null,
    workspaceArchivedAtPresent: Boolean(wsData.archivedAt),
    reportExists: reportSnap.exists,
  });
  // #endregion

  if (!reportSnap.exists) {
    // Build results array from inspections (on-demand for workspaces archived before Phase 5)
    const snapshot = await buildReportResultsFromInspections(orgId, workspaceId);

    const newReportDoc: ReportDocData & {
      archivedAt: unknown;
      archivedBy: string;
      generatedAt: null;
      createdAt: FieldValue;
    } = {
      workspaceId,
      monthYear: wsData.monthYear ?? '',
      label: wsData.label ?? '',
      archivedAt: wsData.archivedAt ?? null,
      archivedBy: wsData.archivedBy ?? uid,
      totalExtinguishers: snapshot.totalExtinguishers,
      passedCount: snapshot.passedCount,
      failedCount: snapshot.failedCount,
      pendingCount: snapshot.pendingCount,
      results: snapshot.results,
      csvDownloadUrl: null,
      csvFilePath: null,
      pdfDownloadUrl: null,
      pdfFilePath: null,
      jsonDownloadUrl: null,
      jsonFilePath: null,
      generatedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    };

    await reportRef.set(newReportDoc);
    reportSnap = await reportRef.get();
  }

  let reportData = reportSnap.data() as ReportDocData;
  let forceRegenerate = false;
  if (!hasFinderFields(reportData.results)) {
    const snapshot = await buildReportResultsFromInspections(orgId, workspaceId);
    await reportRef.update({
      totalExtinguishers: snapshot.totalExtinguishers,
      passedCount: snapshot.passedCount,
      failedCount: snapshot.failedCount,
      pendingCount: snapshot.pendingCount,
      results: snapshot.results,
      csvDownloadUrl: null,
      csvFilePath: null,
      pdfDownloadUrl: null,
      pdfFilePath: null,
      jsonDownloadUrl: null,
      jsonFilePath: null,
      generatedAt: FieldValue.serverTimestamp(),
    });
    reportData = {
      ...reportData,
      totalExtinguishers: snapshot.totalExtinguishers,
      passedCount: snapshot.passedCount,
      failedCount: snapshot.failedCount,
      pendingCount: snapshot.pendingCount,
      results: snapshot.results,
      csvDownloadUrl: null,
      csvFilePath: null,
      pdfDownloadUrl: null,
      pdfFilePath: null,
      jsonDownloadUrl: null,
      jsonFilePath: null,
    };
    forceRegenerate = true;
  }
  const filePathKey = `${format}FilePath` as 'csvFilePath' | 'pdfFilePath' | 'jsonFilePath';
  const existingFilePath = reportData[filePathKey];

  // #region agent log
  debugReportLog('H2,H3,H4', 'report data prepared for generation', {
    format,
    resultCount: Array.isArray(reportData.results) ? reportData.results.length : 'not-array',
    totalExtinguishers: reportData.totalExtinguishers,
    passedCount: reportData.passedCount,
    failedCount: reportData.failedCount,
    pendingCount: reportData.pendingCount,
    existingFilePathPresent: Boolean(existingFilePath),
  });
  // #endregion

  const bucket = getStorage().bucket();
  const storagePath = `org/${orgId}/reports/${workspaceId}/report.${format}`;

  let downloadUrl: string;

  if (existingFilePath && !forceRegenerate) {
    // File already generated — just re-sign a fresh URL
    const existingFile = bucket.file(existingFilePath);
    const [freshUrl] = await existingFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });
    downloadUrl = freshUrl;
    // #region agent log
    debugReportLog('H4', 'existing report file re-signed', { format });
    // #endregion
  } else {
    // Generate the file for the first time
    const results = reportData.results ?? [];

    if (format === 'csv') {
      const csvHeaders = [
        'assetId',
        'serial',
        'parentLocation',
        'locationName',
        'section',
        'vicinity',
        'status',
        'inspectedAt',
        'inspectedBy',
        'inspectedByEmail',
        'notes',
      ];
      const lines: string[] = [csvHeaders.join(',')];
      for (const r of results) {
        lines.push([
          escapeCSVField(r.assetId),
          escapeCSVField(r.serial),
          escapeCSVField(r.parentLocation),
          escapeCSVField(r.locationName),
          escapeCSVField(r.section),
          escapeCSVField(r.vicinity),
          escapeCSVField(r.status),
          escapeCSVField(timestampToString(r.inspectedAt)),
          escapeCSVField(r.inspectedBy),
          escapeCSVField(r.inspectedByEmail),
          escapeCSVField(r.notes),
        ].join(','));
      }
      const csvContent = lines.join('\n');
      const file = bucket.file(storagePath);
      await file.save(csvContent, {
        contentType: 'text/csv',
        metadata: { cacheControl: 'private, max-age=3600' },
      });
      const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
      downloadUrl = url;
    } else if (format === 'json') {
      const jsonContent = JSON.stringify(
        {
          workspaceId: reportData.workspaceId,
          label: reportData.label,
          monthYear: reportData.monthYear,
          stats: {
            total: reportData.totalExtinguishers,
            passed: reportData.passedCount,
            failed: reportData.failedCount,
            pending: reportData.pendingCount,
          },
          results: results.map((r) => ({
            assetId: r.assetId,
            serial: r.serial,
            parentLocation: r.parentLocation,
            locationName: r.locationName,
            section: r.section,
            vicinity: r.vicinity,
            status: r.status,
            inspectedAt: timestampToString(r.inspectedAt),
            inspectedBy: r.inspectedBy,
            inspectedByEmail: r.inspectedByEmail,
            notes: r.notes,
          })),
        },
        null,
        2
      );
      const file = bucket.file(storagePath);
      await file.save(jsonContent, {
        contentType: 'application/json',
        metadata: { cacheControl: 'private, max-age=3600' },
      });
      const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
      downloadUrl = url;
    } else {
      // PDF
      const orgSnap = await adminDb.doc(`org/${orgId}`).get();
      const orgName = orgSnap.exists ? (orgSnap.data()?.name ?? orgId) : orgId;

      const pdfRows: ReportResultRow[] = results.map((r) => ({
        assetId: r.assetId,
        serial: r.serial,
        parentLocation: r.parentLocation,
        locationName: r.locationName,
        section: r.section,
        vicinity: r.vicinity,
        status: r.status,
        inspectedAt: timestampToString(r.inspectedAt),
        inspectedBy: r.inspectedByEmail ?? r.inspectedBy ?? '',
        notes: r.notes,
        checklistData: r.checklistData,
      }));

      // #region agent log
      debugReportLog('H3', 'pdf rows prepared', {
        rowCount: pdfRows.length,
        statsTotal: reportData.totalExtinguishers,
        orgNamePresent: Boolean(orgName),
      });
      // #endregion

      const pdfBuffer = await generateInspectionReportPDF({
        orgName,
        label: reportData.label,
        monthYear: reportData.monthYear,
        generatedAt: new Date(),
        stats: {
          total: reportData.totalExtinguishers,
          passed: reportData.passedCount,
          failed: reportData.failedCount,
          pending: reportData.pendingCount,
        },
        results: pdfRows,
      });

      const file = bucket.file(storagePath);
      await file.save(pdfBuffer, {
        contentType: 'application/pdf',
        metadata: { cacheControl: 'private, max-age=3600' },
      });
      const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
      downloadUrl = url;
    }

    // Update report doc with file path + URL and generatedAt timestamp
    const updatePayload: Record<string, unknown> = {
      [filePathKey]: storagePath,
      [`${format}DownloadUrl`]: downloadUrl,
      generatedAt: FieldValue.serverTimestamp(),
    };
    await reportRef.update(updatePayload);
    // #region agent log
    debugReportLog('H4', 'new report file saved and report doc updated', { format });
    // #endregion
  }

  // Write audit log
  await writeAuditLog(orgId, {
    action: 'report.generated',
    performedBy: uid,
    performedByEmail: member.email,
    entityType: 'report',
    entityId: workspaceId,
    details: { format, workspaceId },
  });

  return { downloadUrl, reportId: workspaceId };
  } catch (err) {
    const error = err as { name?: unknown; code?: unknown; message?: unknown };
    // #region agent log
    debugReportLog('H1,H2,H3,H4,H5', 'generateReport threw before completion', {
      errorName: typeof error.name === 'string' ? error.name : null,
      errorCode: typeof error.code === 'string' ? error.code : null,
      errorMessage: typeof error.message === 'string' ? error.message : String(err),
    });
    // #endregion
    throw err;
  }
});
