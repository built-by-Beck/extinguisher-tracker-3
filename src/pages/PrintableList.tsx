/**
 * Printable extinguisher list — landscape-oriented, print-friendly table.
 * Uses @media print CSS to hide controls and show repeat table headers.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import {
  isInventoryActiveRecord,
  isOfficiallyExpiredExtinguisher,
  isPossibleExpiredCandidate,
  subscribeToExtinguishers,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import { getComplianceLabel } from '../utils/compliance.ts';

type PrintMode = 'all' | 'expired' | 'candidates';

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
  expiryStatus: string;
  mfgYear: string;
  expYear: string;
  lastInspection: string;
}

function resolvePrintMode(value: string | null): PrintMode {
  return value === 'expired' || value === 'candidates' ? value : 'all';
}

function getModeTitle(mode: PrintMode): string {
  if (mode === 'expired') return 'Marked Expired Extinguishers';
  if (mode === 'candidates') return 'Possible Expired Candidates';
  return 'Fire Extinguisher Inventory';
}

function toPrintRow(ext: Extinguisher, currentYear: number): PrintRow {
  const locationParts = [ext.parentLocation, ext.section, ext.vicinity].filter(Boolean);
  const isExpired = isOfficiallyExpiredExtinguisher(ext);
  const isCandidate = isPossibleExpiredCandidate(ext, currentYear);
  return {
    assetId: ext.assetId || '',
    serial: ext.serial || '',
    location: locationParts.join(' > ') || '',
    category: ext.category || '',
    status: (ext.complianceStatus ? getComplianceLabel(ext.complianceStatus) : ext.category || '').toUpperCase(),
    expiryStatus: isExpired ? 'MARKED EXPIRED' : isCandidate ? 'POSSIBLE CANDIDATE' : '',
    mfgYear: ext.manufactureYear != null ? String(ext.manufactureYear) : '',
    expYear: ext.expirationYear != null ? String(ext.expirationYear) : '',
    lastInspection: formatDate(ext.lastMonthlyInspection),
  };
}

export default function PrintableList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userProfile } = useAuth();
  const { org } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';
  const mode = resolvePrintMode(searchParams.get('mode'));
  const title = getModeTitle(mode);

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
    const currentYear = new Date().getFullYear();
    const filtered = items.filter((ext) => {
      if (mode === 'all') return true;
      if (!isInventoryActiveRecord(ext as unknown as Record<string, unknown>)) return false;
      if (mode === 'expired') return isOfficiallyExpiredExtinguisher(ext);
      return isPossibleExpiredCandidate(ext, currentYear);
    });
    const mapped = filtered.map((ext) => toPrintRow(ext, currentYear));
    mapped.sort((a, b) => {
      const loc = a.location.localeCompare(b.location);
      if (loc !== 0) return loc;
      return a.assetId.localeCompare(b.assetId, undefined, { numeric: true });
    });
    return mapped;
  }, [items, mode]);

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
            <h1 className="text-lg font-semibold">{title}</h1>
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
          <h1 className="text-xl font-bold">{title}</h1>
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
          <p className="py-10 text-center text-gray-500">
            {mode === 'expired'
              ? 'No extinguishers are marked expired.'
              : mode === 'candidates'
              ? 'No possible expired candidates found.'
              : 'No extinguishers found.'}
          </p>
        ) : (
          <>
            <div className="no-print mb-2 text-sm text-gray-700">
              Total: {rows.length} extinguisher{rows.length !== 1 ? 's' : ''}
              {mode === 'expired' && (
                <span className="ml-2 text-gray-500">
                  Official list: only units marked expired are included.
                </span>
              )}
              {mode === 'candidates' && (
                <span className="ml-2 text-gray-500">
                  Candidate list: manufacture year is 6+ years old and the unit is not marked expired.
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border border-gray-300 text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="w-[110px] border border-gray-300 px-2 py-1 text-left">Asset ID</th>
                    <th className="w-[130px] border border-gray-300 px-2 py-1 text-left">Serial</th>
                    <th className="w-[250px] border border-gray-300 px-2 py-1 text-left">Location</th>
                    <th className="w-[110px] border border-gray-300 px-2 py-1 text-left">Category</th>
                    <th className="w-[100px] border border-gray-300 px-2 py-1 text-left">Status</th>
                    <th className="w-[120px] border border-gray-300 px-2 py-1 text-left">Expiry Flag</th>
                    <th className="w-[80px] border border-gray-300 px-2 py-1 text-left">Mfg Year</th>
                    <th className="w-[80px] border border-gray-300 px-2 py-1 text-left">Exp Year</th>
                    <th className="w-[120px] border border-gray-300 px-2 py-1 text-left">Last Inspection</th>
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
                      <td className="break-words border border-gray-300 px-2 py-1">{r.expiryStatus}</td>
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
