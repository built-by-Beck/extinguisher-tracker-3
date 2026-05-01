import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import {
  isAssetIdTaken,
  isBarcodeTaken,
  isSerialTaken,
  subscribeToExtinguishers,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import {
  listReplacementHistory,
  updateReplacementHistoryStatus,
  type ReplacementHistoryListRow,
} from '../services/lifecycleService.ts';

function formatTimestamp(ts: unknown): string {
  if (!ts) return '—';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  const d = new Date(String(ts));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '—';
}

interface ReturnModalState {
  row: ReplacementHistoryListRow;
  assetId: string;
  serial: string;
  barcode: string;
  error: string;
  saving: boolean;
}

export default function ReplacedExtinguishers() {
  const { userProfile } = useAuth();
  const { hasRole } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';
  const canEdit = hasRole(['owner', 'admin']);

  const [rows, setRows] = useState<ReplacementHistoryListRow[]>([]);
  const [extinguishers, setExtinguishers] = useState<Extinguisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [returnModal, setReturnModal] = useState<ReturnModalState | null>(null);

  const loadRows = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      setRows(await listReplacementHistory(orgId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load replaced extinguishers.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToExtinguishers(orgId, setExtinguishers);
  }, [orgId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const extById = useMemo(() => new Map(extinguishers.map((ext) => [ext.id, ext])), [extinguishers]);

  async function saveStatus(row: ReplacementHistoryListRow, patch: Partial<ReplacementHistoryListRow>) {
    if (!orgId || !canEdit) return;
    const nextStatus = {
      waitingForService: patch.waitingForService ?? row.waitingForService === true,
      sentForService: patch.sentForService ?? row.sentForService === true,
      discarded: patch.discarded ?? row.discarded === true,
      returned: patch.returned ?? row.returned === true,
    };
    setSavingId(row.id);
    setError('');
    try {
      await updateReplacementHistoryStatus(orgId, row.currentExtinguisherId, row.id, nextStatus);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update replacement status.');
    } finally {
      setSavingId(null);
    }
  }

  async function submitReturnToSpare() {
    if (!orgId || !returnModal) return;
    const currentModal = returnModal;
    const assetId = returnModal.assetId.trim();
    const serial = returnModal.serial.trim();
    const barcode = returnModal.barcode.trim();
    if (!assetId || !serial) {
      setReturnModal({ ...returnModal, error: 'Spare asset ID and serial number are required.' });
      return;
    }

    setReturnModal({ ...returnModal, saving: true, error: '' });
    try {
      if (await isAssetIdTaken(orgId, assetId)) throw new Error(`Asset ID "${assetId}" is already active.`);
      if (await isSerialTaken(orgId, serial)) throw new Error(`Serial number "${serial}" is already active.`);
      if (barcode && (await isBarcodeTaken(orgId, barcode))) throw new Error(`Barcode "${barcode}" is already active.`);

      const prior = currentModal.row.priorSnapshot ?? {};
      await updateReplacementHistoryStatus(
        orgId,
        currentModal.row.currentExtinguisherId,
        currentModal.row.id,
        {
          waitingForService: currentModal.row.waitingForService === true,
          sentForService: currentModal.row.sentForService === true,
          discarded: false,
          returned: true,
        },
        {
          assetId,
          serial,
          barcode: barcode || null,
          locationId: text(prior.locationId) === '—' ? null : text(prior.locationId),
          parentLocation: text(prior.parentLocation) === '—' ? null : text(prior.parentLocation),
          section: text(prior.section) === '—' ? null : text(prior.section),
          vicinity: text(prior.vicinity) === '—' ? null : text(prior.vicinity),
        },
      );
      setReturnModal(null);
      await loadRows();
    } catch (err) {
      setReturnModal({
        ...returnModal,
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to return extinguisher to spare inventory.',
      });
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Replaced Extinguishers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Old physical extinguishers archived during replacement, shown beside the current unit that replaced them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-red-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Archive className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 text-base font-semibold text-gray-900">No replacements recorded yet</h2>
          <p className="mt-1 text-sm text-gray-500">Use Replace Extinguisher from an active extinguisher detail page.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const prior = row.priorSnapshot ?? {};
            const current = extById.get(row.currentExtinguisherId);
            return (
              <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-2 border-b border-gray-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Replaced {formatTimestamp(row.replacedAt)}</p>
                    <p className="text-xs text-gray-500">{row.reason || 'No reason recorded'}</p>
                  </div>
                  {current?.id && (
                    <Link to={`/dashboard/inventory/${current.id}`} className="text-sm font-medium text-red-700 hover:underline">
                      Open current extinguisher
                    </Link>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_260px]">
                  <div className="rounded-lg border border-orange-100 bg-orange-50 p-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-orange-900">
                      Old retired unit
                    </h3>
                    <div className="space-y-1 text-sm text-orange-950">
                      <div>Asset ID: <span className="font-mono">{row.previousAssetId ?? text(prior.assetId)}</span></div>
                      <div>Serial: <span className="font-mono">{row.previousSerial ?? text(prior.serial)}</span></div>
                      <div>Barcode: <span className="font-mono">{row.previousBarcode ?? text(prior.barcode)}</span></div>
                      <div>Type: {text(prior.extinguisherType)}</div>
                      <div>Size: {text(prior.extinguisherSize)}</div>
                      <div>Location: {[text(prior.parentLocation), text(prior.section), text(prior.vicinity)].filter((v) => v !== '—').join(' / ') || '—'}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-green-900">
                      Current replacement unit
                    </h3>
                    <div className="space-y-1 text-sm text-green-950">
                      <div>Asset ID: <span className="font-mono">{current?.assetId ?? row.newAssetId ?? '—'}</span></div>
                      <div>Serial: <span className="font-mono">{current?.serial ?? row.newSerial ?? '—'}</span></div>
                      <div>Barcode: <span className="font-mono">{current?.barcode ?? row.newBarcode ?? '—'}</span></div>
                      <div>Type: {current?.extinguisherType ?? '—'}</div>
                      <div>Size: {current?.extinguisherSize ?? '—'}</div>
                      <div>Location: {current ? [current.parentLocation, current.section, current.vicinity].filter(Boolean).join(' / ') || '—' : '—'}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">Retired service status</h3>
                    <div className="space-y-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" disabled={!canEdit || savingId === row.id} checked={row.waitingForService === true} onChange={(e) => void saveStatus(row, { waitingForService: e.target.checked })} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                        Waiting for service
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" disabled={!canEdit || savingId === row.id} checked={row.sentForService === true} onChange={(e) => void saveStatus(row, { sentForService: e.target.checked })} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                        Sent off for 6-year / hydro
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" disabled={!canEdit || savingId === row.id || row.returned === true} checked={row.discarded === true} onChange={(e) => void saveStatus(row, { discarded: e.target.checked })} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                        Discarded
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={!canEdit || savingId === row.id || row.returned === true}
                          checked={row.returned === true}
                          onChange={(e) => {
                            if (!e.target.checked) return;
                            setReturnModal({
                              row,
                              assetId: '',
                              serial: row.previousSerial ?? text(prior.serial),
                              barcode: row.previousBarcode ?? '',
                              error: '',
                              saving: false,
                            });
                          }}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        Returned to spare inventory
                      </label>
                      {row.returnedSpareExtinguisherId && (
                        <Link to={`/dashboard/inventory/${row.returnedSpareExtinguisherId}`} className="block text-xs font-medium text-red-700 hover:underline">
                          Open spare record
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Return to spare inventory</h2>
            <p className="mt-1 text-sm text-gray-500">
              Create a new active spare record for the returned old extinguisher.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Spare asset ID
                <input value={returnModal.assetId} onChange={(e) => setReturnModal({ ...returnModal, assetId: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Serial
                <input value={returnModal.serial} onChange={(e) => setReturnModal({ ...returnModal, serial: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Barcode
                <input value={returnModal.barcode} onChange={(e) => setReturnModal({ ...returnModal, barcode: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </label>
            </div>
            {returnModal.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{returnModal.error}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" disabled={returnModal.saving} onClick={() => setReturnModal(null)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={returnModal.saving} onClick={() => void submitReturnToSpare()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {returnModal.saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Spare
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
