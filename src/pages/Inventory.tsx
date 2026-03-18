/**
 * Inventory page for EX3.
 * Extinguisher list with filters, search, pagination, compliance column.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Flame,
  Archive,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { AssetLimitBar } from '../components/billing/AssetLimitBar.tsx';
import { DeleteConfirmModal } from '../components/extinguisher/DeleteConfirmModal.tsx';
import { ImportExportBar } from '../components/extinguisher/ImportExportBar.tsx';
import { ComplianceStatusBadge } from '../components/compliance/ComplianceStatusBadge.tsx';
import {
  subscribeToExtinguishers,
  softDeleteExtinguisher,
  getActiveExtinguisherCount,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import { formatDueDate } from '../utils/compliance.ts';

export default function Inventory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canEdit = hasRole(['owner', 'admin']);

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

  const sections = org?.settings?.sections ?? [];

  // Subscribe to extinguishers
  useEffect(() => {
    if (!orgId) return;

    const unsub = subscribeToExtinguishers(orgId, setItems, { showDeleted });
    return () => unsub();
  }, [orgId, showDeleted]);

  // Get total count for asset limit bar
  useEffect(() => {
    if (!orgId) return;
    getActiveExtinguisherCount(orgId).then(setTotalCount);
  }, [orgId, items]);

  // Client-side filtering
  const filtered = items.filter((ext) => {
    if (categoryFilter && ext.category !== categoryFilter) return false;
    if (sectionFilter && ext.section !== sectionFilter) return false;
    if (complianceFilter && ext.complianceStatus !== complianceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        ext.assetId.toLowerCase().includes(q) ||
        ext.serial.toLowerCase().includes(q) ||
        (ext.barcode?.toLowerCase().includes(q) ?? false) ||
        ext.section.toLowerCase().includes(q) ||
        (ext.manufacturer?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  async function handleDelete(reason: string) {
    if (!deleteTarget?.id || !orgId || !user) return;
    await softDeleteExtinguisher(orgId, deleteTarget.id, user.uid, reason);
    setDeleteTarget(null);
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

      {/* Asset limit bar */}
      {org?.assetLimit && (
        <div className="mb-6">
          <AssetLimitBar currentCount={totalCount} />
        </div>
      )}

      {/* Import/Export */}
      {canEdit && (
        <div className="mb-4">
          <ImportExportBar />
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
              {filtered.map((ext) => (
                <tr
                  key={ext.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => ext.id && navigate(`/dashboard/inventory/${ext.id}/edit`)}
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
                    {ext.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
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
                            ext.id && navigate(`/dashboard/inventory/${ext.id}/edit`);
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
    </div>
  );
}
