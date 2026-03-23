/**
 * Inventory page for EX3.
 * Extinguisher list with filters, search, pagination, compliance column.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Flame,
  Archive,
  AlertTriangle,
  Printer,
  Copy,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { AssetLimitBar } from '../components/billing/AssetLimitBar.tsx';
import { DeleteConfirmModal } from '../components/extinguisher/DeleteConfirmModal.tsx';
import { ImportExportBar } from '../components/extinguisher/ImportExportBar.tsx';
import { DuplicateScanModal } from '../components/extinguisher/DuplicateScanModal.tsx';
import { DataImportModal } from '../components/extinguisher/DataImportModal.tsx';
import { ComplianceStatusBadge } from '../components/compliance/ComplianceStatusBadge.tsx';
import {
  subscribeToExtinguishers,
  softDeleteExtinguisher,
  getActiveExtinguisherCount,
  createExtinguisher,
  generateScannedAssetId,
  getAllActiveExtinguishers,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import {
  findDuplicates,
  batchMergeDuplicates,
  type DuplicateGroup,
} from '../services/duplicateService.ts';
import { formatDueDate } from '../utils/compliance.ts';
import { cacheExtinguishersForWorkspace } from '../services/offlineCacheService.ts';
import { ScanSearchBar } from '../components/scanner/ScanSearchBar.tsx';

export default function Inventory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canEdit = hasRole(['owner', 'admin']);
  const canMerge = hasFeature(
    org?.featureFlags as Record<string, boolean> | null | undefined,
    'bulkTagPrinting',
    org?.plan
  );

  const [items, setItems] = useState<Extinguisher[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  // Initialize compliance filter from URL param (from dashboard card clicks)
  const [complianceFilter, setComplianceFilter] = useState(
    searchParams.get('compliance') ?? '',
  );
  const [deleteTarget, setDeleteTarget] = useState<Extinguisher | null>(null);
  
  // Duplicate detection state
  const [showDupModal, setShowDupModal] = useState(false);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [dupScanning, setDupScanning] = useState(false);
  const [dupMerging, setDupMerging] = useState(false);

  // JSON Import state
  const [showImportModal, setShowImportModal] = useState(false);

  const [scanAddTarget, setScanAddTarget] = useState<{ code: string; format: string | null } | null>(null);
  const [scanAddLoading, setScanAddLoading] = useState(false);
  const [scanAddError, setScanAddError] = useState('');

  const sections = org?.settings?.sections ?? [];
  const flags = org?.featureFlags as Record<string, boolean> | null | undefined;
  const canScan = hasFeature(flags, 'cameraBarcodeScan', org?.plan) || hasFeature(flags, 'qrScanning', org?.plan);

  useEffect(() => {
    const scanAddCode = searchParams.get('scanAdd');
    if (!scanAddCode) return;

    if (canEdit && canScan) {
      setScanAddError('');
      setScanAddTarget({
        code: scanAddCode,
        format: searchParams.get('scanFormat'),
      });
    }

    const next = new URLSearchParams(searchParams);
    next.delete('scanAdd');
    next.delete('scanFormat');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canEdit, canScan]);

  // Subscribe to extinguishers — cache on read
  useEffect(() => {
    if (!orgId) return;

    const unsub = subscribeToExtinguishers(orgId, (extinguishers) => {
      setItems(extinguishers);
      // Cache on read (fire-and-forget)
      cacheExtinguishersForWorkspace(
        orgId,
        extinguishers as unknown as Array<Record<string, unknown>>,
      ).catch(() => undefined);
    }, { showDeleted });
    return () => unsub();
  }, [orgId, showDeleted]);

  // Get total count for asset limit bar
  useEffect(() => {
    if (!orgId) return;
    getActiveExtinguisherCount(orgId).then(setTotalCount);
  }, [orgId, items]);

  // Client-side filtering
  const filtered = useMemo(() => {
    return items.filter((ext) => {
      if (categoryFilter && ext.category !== categoryFilter) return false;
      if (sectionFilter && (ext.section || '') !== sectionFilter) return false;
      if (complianceFilter && ext.complianceStatus !== complianceFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          ext.assetId.toLowerCase().includes(q) ||
          ext.serial.toLowerCase().includes(q) ||
          (ext.barcode?.toLowerCase().includes(q) ?? false) ||
          (ext.section || '').toLowerCase().includes(q) ||
          (ext.manufacturer?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [items, categoryFilter, sectionFilter, complianceFilter, searchQuery]);

  async function handleDelete(reason: string) {
    if (!deleteTarget?.id || !orgId || !user) return;
    await softDeleteExtinguisher(orgId, deleteTarget.id, user.uid, reason);
    setDeleteTarget(null);
  }

  const handleDuplicateScan = useCallback(async () => {
    if (!orgId) return;
    setDupScanning(true);
    setShowDupModal(true);
    try {
      const allExt = await getAllActiveExtinguishers(orgId);
      const groups = findDuplicates(allExt);
      setDupGroups(groups);
    } finally {
      setDupScanning(false);
    }
  }, [orgId]);

  const handleDuplicateMerge = useCallback(async () => {
    if (!orgId || !user || dupGroups.length === 0) return;
    setDupMerging(true);
    try {
      await batchMergeDuplicates(orgId, user.uid, dupGroups);
      setShowDupModal(false);
      setDupGroups([]);
    } catch (err) {
      console.error('Merge failed:', err);
    } finally {
      setDupMerging(false);
    }
  }, [orgId, user, dupGroups]);

  async function handleConfirmScannedAdd() {
    if (!scanAddTarget || !orgId || !user) return;
    setScanAddLoading(true);
    setScanAddError('');

    try {
      if (org?.assetLimit) {
        const count = await getActiveExtinguisherCount(orgId);
        if (count >= org.assetLimit) {
          throw new Error(`Asset limit reached (${org.assetLimit}). Upgrade your plan to add more extinguishers.`);
        }
      }

      const assetId = await generateScannedAssetId(orgId, scanAddTarget.code);
      const extId = await createExtinguisher(orgId, user.uid, {
        assetId,
        serial: '',
        barcode: scanAddTarget.code,
        barcodeFormat: scanAddTarget.format,
        section: '',
        locationId: null,
        vicinity: '',
        parentLocation: '',
      });

      setScanAddTarget(null);
      navigate(`/dashboard/inventory/${extId}/edit`);
    } catch (err) {
      setScanAddError(err instanceof Error ? err.message : 'Failed to add scanned extinguisher.');
    } finally {
      setScanAddLoading(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} extinguisher{totalCount !== 1 ? 's' : ''} in your organization
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && canMerge && (
            <button
              onClick={handleDuplicateScan}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Find and merge duplicate asset IDs"
            >
              <Copy className="h-4 w-4" />
              Find Duplicates
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard/inventory/print')}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Print List
          </button>
          {canEdit && (
            <button
              onClick={() => navigate('/dashboard/inventory/new')}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add Extinguisher
            </button>
          )}
        </div>
      </div>

      {/* Asset limit bar */}
      {org?.assetLimit && (
        <div className="mb-6">
          <AssetLimitBar currentCount={totalCount} />
        </div>
      )}

      {/* Quick find — scan/search by barcode/serial/asset ID */}
      {orgId && (
        <div className="mb-4">
          <ScanSearchBar
            orgId={orgId}
            onExtinguisherFound={(ext) => {
              if (ext.id) navigate(`/dashboard/inventory/${ext.id}`);
            }}
            onNotFound={({ code, source, format }) => {
              if (source !== 'scan' || !canEdit || !canScan) {
                return;
              }

              setScanAddError('');
              setScanAddTarget({ code, format: format ?? null });
            }}
            featureFlags={org?.featureFlags}
            plan={org?.plan}
            placeholder="Quick find — scan or type barcode, serial, or asset ID..."
          />
        </div>
      )}

      {/* Import/Export */}
      {canEdit && (
        <div className="mb-4">
          <ImportExportBar onImportJSON={() => setShowImportModal(true)} plan={org?.plan} />
        </div>
      )}

      {/* Filters bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by asset ID, serial, barcode..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All Categories</option>
          <option value="standard">Standard</option>
          <option value="spare">Spare</option>
          <option value="replaced">Replaced</option>
          <option value="retired">Retired</option>
          <option value="out_of_service">Out of Service</option>
        </select>

        {/* Compliance filter */}
        <select
          value={complianceFilter}
          onChange={(e) => setComplianceFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All Compliance</option>
          <option value="compliant">Compliant</option>
          <option value="monthly_due">Monthly Due</option>
          <option value="annual_due">Annual Due</option>
          <option value="six_year_due">Six-Year Due</option>
          <option value="hydro_due">Hydro Due</option>
          <option value="overdue">Overdue</option>
          <option value="missing_data">Missing Data</option>
        </select>

        {/* Overdue quick-filter */}
        <button
          onClick={() => setComplianceFilter(complianceFilter === 'overdue' ? '' : 'overdue')}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
            complianceFilter === 'overdue'
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Overdue
        </button>

        {/* Section filter */}
        {sections.length > 0 && (
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {/* Show deleted toggle */}
        {canEdit && (
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
              showDeleted
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Archive className="h-4 w-4" />
            {showDeleted ? 'Showing Deleted' : 'Deleted'}
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Flame className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            {showDeleted ? 'No deleted extinguishers' : 'No extinguishers yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {showDeleted
              ? 'Deleted extinguishers will appear here.'
              : complianceFilter
              ? 'No extinguishers match the selected compliance filter.'
              : 'Get started by adding your first extinguisher.'}
          </p>
          {!showDeleted && !complianceFilter && canEdit && (
            <button
              onClick={() => navigate('/dashboard/inventory/new')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add Extinguisher
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Asset ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Serial
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Section
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Compliance
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Next Inspection
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((ext: Extinguisher) => (
                <tr
                  key={ext.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => ext.id && navigate(`/dashboard/inventory/${ext.id}`)}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {ext.assetId}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {ext.serial}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {ext.extinguisherType ?? '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {ext.section || '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {ext.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <ComplianceStatusBadge status={ext.complianceStatus} size="sm" />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDueDate(ext.nextMonthlyInspection)}
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ext.id) {
                              navigate(`/dashboard/inventory/${ext.id}/edit`);
                            }
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {!showDeleted && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(ext);
                            }}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          assetId={deleteTarget.assetId}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <DuplicateScanModal
        open={showDupModal}
        groups={dupGroups}
        scanning={dupScanning}
        onMerge={handleDuplicateMerge}
        onCancel={() => { setShowDupModal(false); setDupGroups([]); }}
        merging={dupMerging}
      />

      {showImportModal && (
        <DataImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          orgId={orgId}
          uid={user?.uid ?? ''}
          assetLimit={org?.assetLimit ?? null}
          currentCount={totalCount}
        />
      )}

      {scanAddTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Add scanned extinguisher?</h2>
              <p className="mt-1 text-sm text-gray-500">
                No extinguisher was found for this scanned barcode.
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Scanned code</p>
                <p className="mt-1 break-all font-mono text-sm text-gray-900">{scanAddTarget.code}</p>
              </div>

              <p className="text-sm text-gray-600">
                If this barcode is attached to a fire extinguisher, add it to inventory now. It will be created as unassigned so you can finish the details after.
              </p>

              {scanAddError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{scanAddError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button
                onClick={() => {
                  if (scanAddLoading) return;
                  setScanAddError('');
                  setScanAddTarget(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmScannedAdd()}
                disabled={scanAddLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanAddLoading ? 'Adding...' : 'Add and Edit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
