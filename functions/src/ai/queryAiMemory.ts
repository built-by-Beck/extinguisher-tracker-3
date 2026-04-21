import { onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { validateSubscription } from '../utils/subscription.js';
import { throwInvalidArgument, throwPermissionDenied } from '../utils/errors.js';

type AiNoteStatus = 'open' | 'in_progress' | 'resolved';
type AiMemoryIntentType =
  | 'list_notes_by_month'
  | 'list_expiring_by_year'
  | 'count_replacements_by_month'
  | 'get_extinguisher_inspection_status';

interface MonthWindow {
  year: number;
  month: number;
  startIso: string;
  endIso: string;
  label: string;
}

interface AiMemoryQueryIntent {
  type: AiMemoryIntentType;
  noteStatus?: AiNoteStatus;
  monthWindow?: MonthWindow;
  targetYear?: number;
  assetQuery?: string;
}

interface QueryAiMemoryInput {
  orgId: string;
  intent: AiMemoryQueryIntent;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function parseMonthWindow(intent: AiMemoryQueryIntent): { start: Date; end: Date } {
  if (!intent.monthWindow) {
    throwInvalidArgument('Intent month window is required.');
  }
  const start = new Date(intent.monthWindow.startIso);
  const end = new Date(intent.monthWindow.endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throwInvalidArgument('Intent month window dates are invalid.');
  }
  if (start > end) {
    throwInvalidArgument('Intent month window start must be before end.');
  }
  return { start, end };
}

function parseTargetYear(intent: AiMemoryQueryIntent): number {
  if (!intent.targetYear || !Number.isInteger(intent.targetYear)) {
    throwInvalidArgument('Intent target year is required.');
  }
  if (intent.targetYear < 2000 || intent.targetYear > 2300) {
    throwInvalidArgument('Intent target year is out of range.');
  }
  return intent.targetYear;
}

function parseAssetQuery(intent: AiMemoryQueryIntent): string {
  const value = intent.assetQuery?.trim();
  if (!value) {
    throwInvalidArgument('Intent assetQuery is required.');
  }
  return value;
}

export const queryAiMemory = onCall<QueryAiMemoryInput>(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId, intent } = request.data;

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }
  if (!intent || typeof intent !== 'object') {
    throwInvalidArgument('Intent is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin', 'inspector']);
  await validateSubscription(orgId);

  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  const orgData = orgSnap.data();
  const plan = typeof orgData?.plan === 'string' ? orgData.plan : null;
  const featureEnabled = orgData?.featureFlags?.aiAssistant === true;
  const hasAiAssistant = featureEnabled || ['pro', 'elite', 'enterprise'].includes(plan ?? '');
  if (!hasAiAssistant) {
    throwPermissionDenied('AI assistant is not enabled for this organization.');
  }

  if (intent.type === 'list_notes_by_month') {
    const { start, end } = parseMonthWindow(intent);
    const baseQuery = adminDb
      .collection(`org/${orgId}/aiNotes`)
      .where('createdAt', '>=', Timestamp.fromDate(start))
      .where('createdAt', '<=', Timestamp.fromDate(end))
      .orderBy('createdAt', 'desc')
      .limit(200);
    const snap =
      intent.noteStatus && ['open', 'in_progress', 'resolved'].includes(intent.noteStatus)
        ? await baseQuery.where('status', '==', intent.noteStatus).get()
        : await baseQuery.get();

    const notes = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: (data.title as string | null) ?? null,
        content: (data.content as string) ?? '',
        status: (data.status as AiNoteStatus) ?? 'open',
        source: (data.source as 'manual' | 'ai_suggested') ?? 'manual',
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        createdByEmail: (data.createdByEmail as string | null) ?? null,
      };
    });

    return {
      intentType: intent.type,
      appliedFilters: {
        monthLabel: intent.monthWindow?.label ?? '',
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        status: intent.noteStatus ?? null,
      },
      count: notes.length,
      notes,
    };
  }

  if (intent.type === 'list_expiring_by_year') {
    const targetYear = parseTargetYear(intent);
    const snap = await adminDb
      .collection(`org/${orgId}/extinguishers`)
      .where('deletedAt', '==', null)
      .where('expirationYear', '==', targetYear)
      .orderBy('assetId', 'asc')
      .limit(500)
      .get();

    const expiringExtinguishers = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          assetId: (data.assetId as string) ?? '',
          serial: (data.serial as string) ?? '',
          section: (data.section as string) ?? '',
          parentLocation: (data.parentLocation as string) ?? '',
          expirationYear: (data.expirationYear as number | null) ?? null,
          lifecycleStatus: (data.lifecycleStatus as string | null) ?? null,
          complianceStatus: (data.complianceStatus as string | null) ?? null,
        };
      })
      .filter((ext) => ext.lifecycleStatus !== 'deleted');

    return {
      intentType: intent.type,
      appliedFilters: {
        expirationYear: targetYear,
        deletedAtIsNull: true,
      },
      count: expiringExtinguishers.length,
      expiringExtinguishers,
    };
  }

  if (intent.type === 'count_replacements_by_month') {
    const { start, end } = parseMonthWindow(intent);
    const snap = await adminDb
      .collection(`org/${orgId}/auditLogs`)
      .where('action', '==', 'extinguisher.replaced')
      .where('performedAt', '>=', Timestamp.fromDate(start))
      .where('performedAt', '<=', Timestamp.fromDate(end))
      .orderBy('performedAt', 'desc')
      .limit(500)
      .get();

    const replacementEvents = snap.docs.map((d) => {
      const data = d.data();
      const details = (data.details as Record<string, unknown> | undefined) ?? {};
      return {
        id: d.id,
        performedAt: toIso(data.performedAt),
        performedByEmail: (data.performedByEmail as string | null) ?? null,
        oldAssetId: (details.oldAssetId as string | null) ?? null,
        newAssetId: (details.newAssetId as string | null) ?? null,
        oldExtinguisherId: (details.oldExtinguisherId as string | null) ?? null,
        newExtinguisherId: (details.newExtinguisherId as string | null) ?? null,
        reason: (details.reason as string | null) ?? null,
      };
    });

    return {
      intentType: intent.type,
      appliedFilters: {
        monthLabel: intent.monthWindow?.label ?? '',
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        action: 'extinguisher.replaced',
      },
      count: replacementEvents.length,
      replacementEvents,
    };
  }

  if (intent.type === 'get_extinguisher_inspection_status') {
    const assetQuery = parseAssetQuery(intent);
    const workspacesSnap = await adminDb
      .collection(`org/${orgId}/workspaces`)
      .where('status', '==', 'active')
      .get();
    if (workspacesSnap.empty) {
      return {
        intentType: intent.type,
        appliedFilters: {
          assetQuery,
          activeWorkspaceId: null,
        },
        count: 0,
        inspectionStatusMatches: [],
      };
    }

    const activeWorkspace = workspacesSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as { label?: string; monthYear?: string }) }))
      .sort((a, b) => (b.monthYear ?? '').localeCompare(a.monthYear ?? ''))[0];
    const workspaceId = activeWorkspace?.id ?? null;
    const workspaceLabel = activeWorkspace?.label ?? null;

    if (!workspaceId) {
      return {
        intentType: intent.type,
        appliedFilters: {
          assetQuery,
          activeWorkspaceId: null,
        },
        count: 0,
        inspectionStatusMatches: [],
      };
    }

    const exactSnap = await adminDb
      .collection(`org/${orgId}/inspections`)
      .where('workspaceId', '==', workspaceId)
      .where('assetId', '==', assetQuery)
      .limit(50)
      .get();

    const fallbackSnap = exactSnap.empty
      ? await adminDb
          .collection(`org/${orgId}/inspections`)
          .where('workspaceId', '==', workspaceId)
          .limit(2000)
          .get()
      : null;

    const sourceDocs = exactSnap.empty
      ? (fallbackSnap?.docs ?? []).filter((d) =>
          String((d.data().assetId as string) ?? '')
            .toLowerCase()
            .includes(assetQuery.toLowerCase()),
        )
      : exactSnap.docs;

    const inspectionStatusMatches = sourceDocs.map((d) => {
      const data = d.data();
      return {
        inspectionId: d.id,
        extinguisherId: (data.extinguisherId as string) ?? '',
        assetId: (data.assetId as string) ?? '',
        status: (data.status as string) ?? 'pending',
        section: (data.section as string) ?? '',
        workspaceId,
        workspaceLabel,
        inspectedAt: toIso(data.inspectedAt),
        inspectedByEmail: (data.inspectedByEmail as string | null) ?? null,
        notes: (data.notes as string) ?? '',
      };
    });

    return {
      intentType: intent.type,
      appliedFilters: {
        assetQuery,
        activeWorkspaceId: workspaceId,
        activeWorkspaceLabel: workspaceLabel,
      },
      count: inspectionStatusMatches.length,
      inspectionStatusMatches,
    };
  }

  throwInvalidArgument('Unsupported intent type.');
});
