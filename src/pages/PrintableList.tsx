/**
 * Printable extinguisher list — landscape-oriented, print-friendly table.
 * Uses @media print CSS to hide controls and show repeat table headers.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import {
  subscribeToExtinguishers,
  type Extinguisher,
} from '../services/extinguisherService.ts';

function formatDate(d: unknown): string {
  if (!d) return '';
  try {
    // Firestore Timestamp
    if (d && typeof d === 'object' && 'toDate' in d && typeof (d as { toDate: () => Date }).toDate === 'function') {
      return (d as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    const date = new Date(d as string | number);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(d);
  }
}

interface PrintRow {
  assetId: string;
  serial: string;
  location: string;
  category: string;
  status: string;
  mfgYear: string;
  expYear: string;
  lastInspection: string;
}

function toPrintRow(ext: Extinguisher): PrintRow {
  const locationParts = [ext.parentLocation, ext.section, ext.vicinity].filter(Boolean);
  return {
    assetId: ext.assetId || '',
    serial: ext.serial || '',
    location: locationParts.join(' > ') || '',
    category: ext.category || '',
    status: (ext.complianceStatus || ext.category || '').toUpperCase(),
    mfgYear: ext.manufactureYear != null ? String(ext.manufactureYear) : '',
    expYear: ext.expirationYear != null ? String(ext.expirationYear) : '',
    lastInspection: formatDate(ext.lastMonthlyInspection),
  };
}

export default function PrintableList() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { org } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';

  const canPrint = hasFeature(
    org?.featureFlags as Record<string, boolean> | null | undefined,
    'tagPrinting',
    org?.plan
  );

  const [items, setItems] = useState<Extinguisher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    // If we have org data and can't print, redirect
    if (org && !canPrint) {
      navigate('/dashboard/inventory');
      return;
    }

    setLoading(true);
    const unsub = subscribeToExtinguishers(orgId, (data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, [orgId, org, canPrint, navigate]);

  const rows = useMemo(() => {
    const mapped = items.map(toPrintRow);
    mapped.sort((a, b) => {
      const loc = a.location.localeCompare(b.location);
      if (loc !== 0) return loc;
      return a.assetId.localeCompare(b.assetId, undefined, { numeric: true });
    });
    return mapped;
  }, [items]);

  if (org && !canPrint) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Print styles */}
      <style>{`
        @page { size: landscape; margin: 0.5in; }
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

      {/* Controls bar (hidden on print) */}
      <div className="no-print sticky top-0 z-10 border-b border-gray-300 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard/inventory')}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-lg font-semibold">Printable Inventory List</h1>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="print-only hidden px-4 pt-2">
        <div className="mx-auto flex max-w-[1400px] items-baseline justify-between">
          <h1 className="text-xl font-bold">Fire Extinguisher Inventory</h1>
          <div className="text-sm">Printed: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1400px] p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-gray-500">No extinguishers found.</p>
        ) : (
          <>
            <div className="no-print mb-2 text-sm text-gray-700">
              Total: {rows.length} extinguisher{rows.length !== 1 ? 's' : ''}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-300 text-xs" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 text-left" style={{ width: '110px' }}>Asset ID</th>
                    <th className="border border-gray-300 px-2 py-1 text-left" style={{ width: '130px' }}>Serial</th>
                    <th className="border border-gray-300 px-2 py-1 text-left" style={{ width: '250px' }}>Location</th>
                    <th className="border border-gray-300 px-2 py-1 text-left" style={{ width: '110px' }}>Category</th>
                    <th className="border border-gray-300 px-2 py-1 text-left" style={{ width: '100px' }}>Status</th>
                    <th className="border border-gray-300 px-2 py-1 text-left" style={{ width: '80px' }}>Mfg Year</th>
                    <th className="border border-gray-300 px-2 py-1 text-left" style={{ width: '80px' }}>Exp Year</th>
                    <th className="border border-gray-300 px-2 py-1 text-left" style={{ width: '120px' }}>Last Inspection</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="break-words border border-gray-300 px-2 py-1">{r.assetId}</td>
                      <td className="break-words border border-gray-300 px-2 py-1">{r.serial}</td>
                      <td className="break-words border border-gray-300 px-2 py-1">{r.location}</td>
                      <td className="break-words border border-gray-300 px-2 py-1">{r.category}</td>
                      <td className="break-words border border-gray-300 px-2 py-1">{r.status}</td>
                      <td className="break-words border border-gray-300 px-2 py-1">{r.mfgYear}</td>
                      <td className="break-words border border-gray-300 px-2 py-1">{r.expYear}</td>
                      <td className="break-words border border-gray-300 px-2 py-1">{r.lastInspection}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="no-print mt-4 text-right">
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
