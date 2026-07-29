/**
 * Printable extinguisher list — landscape-oriented, print-friendly table.
 * Supports multi-location filter (building/floor + descendants) and CSV download.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2, Download } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import {
  subscribeToExtinguishers,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import {
  collectLocationScopeIds,
  getBuildingLevelLocations,
  getLocationPath,
  subscribeToLocations,
  type Location,
} from '../services/locationService.ts';
import {
  filterExtinguishersForPrint,
  toDetailedPrintRow,
  type InventoryPrintMode,
} from '../utils/inventoryPrint.ts';

type PrintMode = InventoryPrintMode;

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function resolvePrintMode(value: string | null): PrintMode {
  return value === 'expired' || value === 'candidates' ? value : 'all';
}

function parseLocIds(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getModeTitle(mode: PrintMode): string {
  if (mode === 'expired') return 'Marked Expired Extinguishers';
  if (mode === 'candidates') return 'Possible Expired Candidates';
  return 'Fire Extinguisher Inventory';
}

export default function PrintableList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userProfile } = useAuth();
  const { org } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';
  const mode = resolvePrintMode(searchParams.get('mode'));
  const title = getModeTitle(mode);

  const canPrint = hasFeature(
    org?.featureFlags as Record<string, boolean> | null | undefined,
    'tagPrinting',
    org?.plan,
  );

  const [items, setItems] = useState<Extinguisher[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocIds, setSelectedLocIds] = useState<string[]>(() =>
    parseLocIds(searchParams.get('locs')),
  );

  useEffect(() => {
    setSelectedLocIds(parseLocIds(searchParams.get('locs')));
  }, [searchParams]);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    if (org && !canPrint) {
      navigate('/dashboard/inventory');
      return;
    }

    setLoading(true);
    const unsubExt = subscribeToExtinguishers(orgId, (data) => {
      setItems(data);
      setLoading(false);
    });
    const unsubLoc = subscribeToLocations(orgId, setLocations);
    return () => {
      unsubExt();
      unsubLoc();
    };
  }, [orgId, org, canPrint, navigate]);

  const buildingOptions = useMemo(
    () => getBuildingLevelLocations(locations),
    [locations],
  );

  const locationScopeIds = useMemo(() => {
    if (selectedLocIds.length === 0) return null;
    return collectLocationScopeIds(locations, selectedLocIds);
  }, [locations, selectedLocIds]);

  const filteredExtinguishers = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return filterExtinguishersForPrint({
      items,
      mode,
      locationScopeIds,
      currentYear,
    });
  }, [items, mode, locationScopeIds]);

  const rows = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const mapped = filteredExtinguishers.map((ext) =>
      toDetailedPrintRow(ext, locations, currentYear),
    );
    mapped.sort((a, b) => {
      const loc = a.location.localeCompare(b.location);
      if (loc !== 0) return loc;
      const floor = a.floor.localeCompare(b.floor, undefined, {
        numeric: true,
      });
      if (floor !== 0) return floor;
      return a.assetId.localeCompare(b.assetId, undefined, { numeric: true });
    });
    return mapped;
  }, [filteredExtinguishers, locations]);

  function syncLocsToUrl(ids: string[]) {
    setSelectedLocIds(ids);
    const next = new URLSearchParams(searchParams);
    if (ids.length === 0) next.delete('locs');
    else next.set('locs', ids.join(','));
    setSearchParams(next, { replace: true });
  }

  function toggleLoc(id: string) {
    const set = new Set(selectedLocIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    syncLocsToUrl(Array.from(set));
  }

  function downloadCsv() {
    const headers = [
      'Asset ID',
      'Serial',
      'Barcode',
      'Type',
      'Size',
      'Manufacturer',
      'Location',
      'Floor',
      'Vicinity',
      'Category',
      'Status',
      'Expiry Flag',
      'Mfg Year',
      'Exp Year',
      'Last Inspection',
    ];
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.assetId,
          r.serial,
          r.barcode,
          r.type,
          r.size,
          r.manufacturer,
          r.location,
          r.floor,
          r.vicinity,
          r.category,
          r.status,
          r.expiryStatus,
          r.mfgYear,
          r.expYear,
          r.lastInspection,
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extinguisher-inventory-${mode}${
      selectedLocIds.length ? `-filtered` : ''
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedLabels = selectedLocIds
    .map((id) => locations.find((l) => l.id === id)?.name)
    .filter(Boolean);

  if (org && !canPrint) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @page { size: landscape; margin: 0.4in; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body, html { background: #ffffff !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b border-gray-300 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard/inventory')}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadCsv}
              disabled={rows.length === 0}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="print-only hidden px-4 pt-2">
        <div className="mx-auto flex max-w-[1600px] items-baseline justify-between">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {selectedLabels.length > 0 && (
              <p className="text-sm">Locations: {selectedLabels.join(', ')}</p>
            )}
          </div>
          <div className="text-sm">Printed: {new Date().toLocaleString()}</div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] p-4">
        <div className="no-print mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-sm font-medium text-gray-800">
            Filter by location (optional)
          </p>
          <p className="mb-2 text-xs text-gray-500">
            Select one or more buildings (or other top locations). Includes all
            floors and rooms underneath. Leave empty for the full inventory.
          </p>
          {buildingOptions.length === 0 ? (
            <p className="text-sm text-gray-500">No locations configured.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {buildingOptions.map((loc) => {
                const checked = selectedLocIds.includes(loc.id!);
                return (
                  <label
                    key={loc.id}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                      checked
                        ? 'border-red-400 bg-red-50 text-red-900'
                        : 'border-gray-300 bg-white text-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLoc(loc.id!)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    {getLocationPath(locations, loc.id!)}
                  </label>
                );
              })}
            </div>
          )}
          {selectedLocIds.length > 0 && (
            <button
              type="button"
              onClick={() => syncLocsToUrl([])}
              className="mt-2 text-xs font-medium text-red-700 hover:underline"
            >
              Clear location filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-gray-500">
            {mode === 'expired'
              ? 'No extinguishers are marked expired.'
              : mode === 'candidates'
                ? 'No possible expired candidates found.'
                : selectedLocIds.length > 0
                  ? 'No extinguishers in the selected locations.'
                  : 'No extinguishers found.'}
          </p>
        ) : (
          <>
            <div className="no-print mb-2 text-sm text-gray-700">
              Total: {rows.length} extinguisher{rows.length !== 1 ? 's' : ''}
              {selectedLabels.length > 0 && (
                <span className="ml-2 text-gray-500">
                  Filtered: {selectedLabels.join(', ')}
                </span>
              )}
              {mode === 'expired' && (
                <span className="ml-2 text-gray-500">
                  Official list: only units marked expired are included.
                </span>
              )}
              {mode === 'candidates' && (
                <span className="ml-2 text-gray-500">
                  Candidate list: manufacture year is 6+ years old and the unit
                  is not marked expired.
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-300 text-[10px] leading-tight">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Asset ID
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Serial
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Barcode
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Type
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Size
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Manufacturer
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Location
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Floor
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Vicinity
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Category
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Status
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Mfg
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Exp
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1 text-left">
                      Last Insp.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr
                      key={`${r.assetId}-${idx}`}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.assetId}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.serial}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.barcode}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.type}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.size}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.manufacturer}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.location}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.floor}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.vicinity}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.category}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.status}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.mfgYear}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.expYear}
                      </td>
                      <td className="break-words border border-gray-300 px-1.5 py-1">
                        {r.lastInspection}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="no-print mt-4 flex justify-end gap-2">
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
