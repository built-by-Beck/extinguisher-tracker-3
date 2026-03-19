/**
 * GuestInventory — read-only extinguisher list for guest access.
 * Supports filtering by category, section, and compliance status.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { Package, Search } from 'lucide-react';
import { useGuest } from '../../hooks/useGuest.ts';
import {
  subscribeToExtinguishers,
  type Extinguisher,
} from '../../services/extinguisherService.ts';
import { ComplianceStatusBadge } from '../../components/compliance/ComplianceStatusBadge.tsx';

const PAGE_SIZE = 25;

export default function GuestInventory() {
  const { guestOrgId } = useGuest();
  const orgId = guestOrgId ?? '';

  const [items, setItems] = useState<Extinguisher[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToExtinguishers(orgId, (extinguishers) => {
      setItems(extinguishers);
    }, { showDeleted: false });
  }, [orgId]);

  // Client-side filtering
  const filtered = items.filter((ext) => {
    if (categoryFilter && ext.category !== categoryFilter) return false;
    if (sectionFilter && ext.section !== sectionFilter) return false;
    if (complianceFilter && ext.complianceStatus !== complianceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchAsset = ext.assetId?.toLowerCase().includes(q);
      const matchSerial = ext.serial?.toLowerCase().includes(q);
      const matchVicinity = ext.vicinity?.toLowerCase().includes(q);
      if (!matchAsset && !matchSerial && !matchVicinity) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Unique values for filter dropdowns
  const categories = Array.from(new Set(items.map((e) => e.category).filter(Boolean)));
  const sections = Array.from(new Set(items.map((e) => e.section).filter(Boolean)));
  const complianceStatuses = [
    'compliant', 'monthly_due', 'annual_due', 'six_year_due', 'hydro_due', 'overdue', 'missing_data',
  ];

  function handleFilterChange() {
    setPage(1);
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Package className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} extinguisher{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search asset ID, serial..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }}
            className="rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); handleFilterChange(); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={sectionFilter}
          onChange={(e) => { setSectionFilter(e.target.value); handleFilterChange(); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="">All Sections</option>
          {sections.map((sec) => (
            <option key={sec} value={sec}>{sec}</option>
          ))}
        </select>

        <select
          value={complianceFilter}
          onChange={(e) => { setComplianceFilter(e.target.value); handleFilterChange(); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="">All Compliance</option>
          {complianceStatuses.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Asset ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Serial</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Section</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    No extinguishers found.
                  </td>
                </tr>
              ) : (
                paginated.map((ext) => (
                  <tr key={ext.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{ext.assetId ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ext.serial ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ext.category ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ext.vicinity ?? ext.parentLocation ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ext.section ?? '—'}</td>
                    <td className="px-4 py-3">
                      <ComplianceStatusBadge status={ext.complianceStatus ?? null} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
