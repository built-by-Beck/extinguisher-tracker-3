/**
 * Callable diagnostic: Firestore Query Explain for extinguisher identifier lookups.
 * Owner/admin only. Uses Admin SDK (Query Explain is not available in the Web SDK).
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import type { Query } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument } from '../utils/errors.js';

const LOOKUP_FIELDS = ['barcode', 'assetId', 'serial', 'qrCodeValue'] as const;

type LookupField = (typeof LOOKUP_FIELDS)[number];

interface ExplainExtinguisherSearchInput {
  orgId: string;
  searchInput: string;
  /** When true, executes queries and returns runtime stats (billed reads). Default false. */
  analyze?: boolean;
  /** Include the unbounded inventory list query (deletedAt + orderBy createdAt). */
  includeInventoryList?: boolean;
}

interface ExplainQueryResult {
  name: string;
  field?: LookupField;
  queryType: 'strict-active' | 'legacy-deletedAt-only' | 'inventory-list';
  filters: string[];
  limit: number | null;
  planSummary: unknown;
  executionStats: unknown;
}

function strictLookupQuery(
  orgId: string,
  field: LookupField,
  code: string,
): Query {
  return adminDb
    .collection(`org/${orgId}/extinguishers`)
    .where('deletedAt', '==', null)
    .where('lifecycleStatus', '==', 'active')
    .where(field, '==', code)
    .limit(8);
}

function legacyLookupQuery(
  orgId: string,
  field: LookupField,
  code: string,
): Query {
  return adminDb
    .collection(`org/${orgId}/extinguishers`)
    .where('deletedAt', '==', null)
    .where(field, '==', code)
    .limit(50);
}

function inventoryListQuery(orgId: string): Query {
  return adminDb
    .collection(`org/${orgId}/extinguishers`)
    .where('deletedAt', '==', null)
    .orderBy('createdAt', 'desc');
}

async function runExplain(
  q: Query,
  analyze: boolean,
): Promise<{ planSummary: unknown; executionStats: unknown }> {
  const explainResults = await q.explain({ analyze });
  const metrics = explainResults.metrics;
  return {
    planSummary: metrics.planSummary ?? null,
    executionStats: metrics.executionStats ?? null,
  };
}

export const explainExtinguisherSearch = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const {
    orgId,
    searchInput,
    analyze = false,
    includeInventoryList = false,
  } = request.data as ExplainExtinguisherSearchInput;

  if (!orgId || typeof orgId !== 'string')
    throwInvalidArgument('orgId is required.');
  const code = searchInput?.trim();
  if (!code) throwInvalidArgument('searchInput is required.');

  await validateMembership(orgId, uid, ['owner', 'admin']);

  const results: ExplainQueryResult[] = [];

  for (const field of LOOKUP_FIELDS) {
    const strict = strictLookupQuery(orgId, field, code);
    const strictMetrics = await runExplain(strict, analyze);
    results.push({
      name: `strict-${field}`,
      field,
      queryType: 'strict-active',
      filters: [
        'deletedAt==null',
        'lifecycleStatus==active',
        `${field}==${code}`,
      ],
      limit: 8,
      ...strictMetrics,
    });
  }

  for (const field of LOOKUP_FIELDS) {
    const legacy = legacyLookupQuery(orgId, field, code);
    const legacyMetrics = await runExplain(legacy, analyze);
    results.push({
      name: `legacy-${field}`,
      field,
      queryType: 'legacy-deletedAt-only',
      filters: ['deletedAt==null', `${field}==${code}`],
      limit: 50,
      ...legacyMetrics,
    });
  }

  if (includeInventoryList) {
    const list = inventoryListQuery(orgId);
    const listMetrics = await runExplain(list, analyze);
    results.push({
      name: 'inventory-list',
      queryType: 'inventory-list',
      filters: ['deletedAt==null', 'orderBy createdAt desc'],
      limit: null,
      ...listMetrics,
    });
  }

  return {
    orgId,
    searchInput: code,
    analyze,
    queries: results,
    hints: [
      'Compare index_entries_scanned vs documents_scanned in executionStats.debugStats.',
      'TableScan in planSummary usually means a missing or mismatched composite index.',
      'Strict queries should use deletedAt + lifecycleStatus + field indexes from firestore.indexes.json.',
      'Inventory pages subscribe to the inventory-list query with no limit — large orgs may feel slow before search even runs.',
    ],
  };
});
