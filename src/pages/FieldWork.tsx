/**
 * Field Work list — org-specific checksheets and printable field documents.
 * Route: /dashboard/field-work
 *
 * Author: built_by_Beck
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Loader2,
  Plus,
  Printer,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useAiAssistant } from '../contexts/AiAssistantContext.tsx';
import { hasFeature } from '../lib/planConfig.ts';
import { createBlankChecksheetSchema } from '../lib/workDocumentTemplates.ts';
import {
  createWorkDocumentCall,
  subscribeToWorkDocuments,
} from '../services/workDocumentService.ts';
import { generateEgressStairwellSheet } from '../services/workDocumentGenerator.ts';
import {
  subscribeToLocations,
  type Location,
} from '../services/locationService.ts';
import type { WorkDocument, WorkDocumentStatus } from '../types/workDocument.ts';

const CATEGORY_LABELS: Record<string, string> = {
  egress_lighting: 'Egress lighting',
  stairwell: 'Stairwell',
  exit_path: 'Exit path',
  general: 'General',
  custom: 'Custom',
};

const STATUS_LABELS: Record<WorkDocumentStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

function formatTimestamp(timestamp: unknown): string {
  if (!timestamp) return '';
  try {
    let date: Date;
    if (
      typeof timestamp === 'object' &&
      timestamp !== null &&
      'toDate' in timestamp &&
      typeof (timestamp as { toDate: () => Date }).toDate === 'function'
    ) {
      date = (timestamp as { toDate: () => Date }).toDate();
    } else {
      return '';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function FieldWork() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const { openAssistant } = useAiAssistant();
  const orgId = userProfile?.activeOrgId ?? '';
  const canManage = hasRole(['owner', 'admin', 'inspector']);
  const hasAi = hasFeature(
    org?.featureFlags as Record<string, boolean> | null | undefined,
    'aiAssistant',
    org?.plan,
  );

  const [documents, setDocuments] = useState<WorkDocument[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkDocumentStatus | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToWorkDocuments(orgId, setDocuments);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (statusFilter && doc.status !== statusFilter) return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        (doc.description ?? '').toLowerCase().includes(q) ||
        (doc.relatedLocationLabel ?? '').toLowerCase().includes(q)
      );
    });
  }, [documents, search, statusFilter]);

  async function handleCreateBlank() {
    if (!orgId || !canManage) return;
    setBusy(true);
    setError(null);
    try {
      const { documentId } = await createWorkDocumentCall({
        orgId,
        title: 'New checksheet',
        description: 'Edit this document and add sections for your walk.',
        type: 'checksheet',
        category: 'general',
        status: 'draft',
        schema: createBlankChecksheetSchema(),
        source: 'manual',
      });
      navigate(`/dashboard/field-work/${documentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateEgressTemplate() {
    if (!orgId || !canManage) return;
    setBusy(true);
    setError(null);
    try {
      const draft = generateEgressStairwellSheet({ locations });
      const { documentId } = await createWorkDocumentCall({
        orgId,
        title: draft.title,
        description: draft.description,
        type: 'checksheet',
        category: draft.category,
        status: 'active',
        schema: draft.schema,
        source: 'template',
        relatedLocationId: draft.relatedLocationId,
        relatedLocationLabel: draft.relatedLocationLabel,
      });
      navigate(`/dashboard/field-work/${documentId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate checksheet',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!hasAi) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Field Work</h1>
        <p className="mt-3 text-gray-600">
          Personalized checksheets and printable field documents are available on
          Pro plans with AI assistant enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <ClipboardList className="h-7 w-7 text-red-600" />
            Field Work
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            AI-generated or hand-built checksheets for egress lighting, stairwell
            walks, and other org-specific field work. Printable now — in-app
            pass/fail tracking comes later.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreateBlank()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Blank sheet
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGenerateEgressTemplate()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Printer className="h-4 w-4" />
              Egress stairwell template
            </button>
            <button
              type="button"
              onClick={() =>
                openAssistant(
                  'Create a checksheet for stairwell egress lights in Building B',
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <Sparkles className="h-4 w-4" />
              Ask AI
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as WorkDocumentStatus | '')
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-gray-400" />
          <h2 className="mt-3 text-lg font-medium text-gray-900">
            No field work documents yet
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Start with the egress stairwell template or ask AI to build a sheet
            from your location tree.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((doc) => (
            <Link
              key={doc.id}
              to={`/dashboard/field-work/${doc.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-red-200 hover:shadow"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{doc.title}</h2>
                  {doc.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {doc.description}
                    </p>
                  )}
                  {doc.relatedLocationLabel && (
                    <p className="mt-1 text-xs text-gray-500">
                      {doc.relatedLocationLabel}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                    {CATEGORY_LABELS[doc.category] ?? doc.category}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                    {STATUS_LABELS[doc.status]}
                  </span>
                  <span className="text-gray-500">
                    Updated {formatTimestamp(doc.updatedAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
