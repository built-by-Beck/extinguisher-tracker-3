/**
 * ReplaceExtinguisherModal
 * In-place replacement: updates serial/barcode and physical fields on the same document.
 *
 * Author: built_by_Beck
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2 } from 'lucide-react';
import { isSerialTaken, isBarcodeTaken, isAssetIdTaken, type Extinguisher } from '../../services/extinguisherService.ts';
import { replaceExtinguisher } from '../../services/lifecycleService.ts';

interface ReplaceExtinguisherModalProps {
  orgId: string;
  oldExtinguisherId: string;
  oldExtinguisher: Extinguisher;
  onClose: () => void;
}

export function ReplaceExtinguisherModal({
  orgId,
  oldExtinguisherId,
  oldExtinguisher,
  onClose,
}: ReplaceExtinguisherModalProps) {
  const navigate = useNavigate();

  const oldAssetId = oldExtinguisher.assetId;
  const [assetMode, setAssetMode] = useState<'reuse' | 'replace'>('reuse');
  const [newAssetId, setNewAssetId] = useState(oldAssetId);
  const [serial, setSerial] = useState('');
  const [barcode, setBarcode] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [extinguisherType, setExtinguisherType] = useState('');
  const [serviceClass, setServiceClass] = useState('');
  const [extinguisherSize, setExtinguisherSize] = useState('');
  const [manufactureYear, setManufactureYear] = useState('');
  const [expirationYear, setExpirationYear] = useState('');
  const [sixYearServiceCompleted, setSixYearServiceCompleted] = useState(false);
  const [hydroServiceCompleted, setHydroServiceCompleted] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!serial.trim()) {
      setError('New Serial Number is required.');
      return;
    }

    setSubmitting(true);
    try {
      const serialInUse = await isSerialTaken(orgId, serial.trim(), oldExtinguisherId);
      if (serialInUse) {
        setError(`Serial number "${serial.trim()}" is already in use by another active extinguisher.`);
        setSubmitting(false);
        return;
      }

      if (barcode.trim()) {
        const bcTaken = await isBarcodeTaken(orgId, barcode.trim(), oldExtinguisherId);
        if (bcTaken) {
          setError(`Barcode "${barcode.trim()}" is already in use by another active extinguisher.`);
          setSubmitting(false);
          return;
        }
      }

      const requestedAssetId = assetMode === 'replace' ? newAssetId.trim() : oldAssetId;
      if (!requestedAssetId) {
        setError('Asset ID is required.');
        setSubmitting(false);
        return;
      }

      if (assetMode === 'replace') {
        const assetInUse = await isAssetIdTaken(orgId, requestedAssetId, oldExtinguisherId);
        if (assetInUse) {
          setError(`Asset ID "${requestedAssetId}" is already in use by another active extinguisher.`);
          setSubmitting(false);
          return;
        }
      }

      const my = manufactureYear.trim() ? parseInt(manufactureYear.trim(), 10) : null;
      const ey = expirationYear.trim() ? parseInt(expirationYear.trim(), 10) : null;
      if (manufactureYear.trim() && Number.isNaN(my)) {
        setError('Manufacture year must be a number.');
        setSubmitting(false);
        return;
      }
      if (expirationYear.trim() && Number.isNaN(ey)) {
        setError('Expiration year must be a number.');
        setSubmitting(false);
        return;
      }

      const newExtinguisherData = {
        assetId: requestedAssetId,
        serial: serial.trim(),
        barcode: barcode.trim() || null,
        manufacturer: manufacturer.trim() || null,
        extinguisherType: extinguisherType || null,
        serviceClass: serviceClass.trim() || null,
        extinguisherSize: extinguisherSize.trim() || null,
        manufactureYear: my != null && !Number.isNaN(my) ? my : null,
        expirationYear: ey != null && !Number.isNaN(ey) ? ey : null,
        lastSixYearMaintenance: sixYearServiceCompleted,
        lastHydroTest: hydroServiceCompleted,
        notes: notes.trim() || null,
      };

      const result = await replaceExtinguisher(
        orgId,
        oldExtinguisherId,
        newExtinguisherData,
        reason.trim() || undefined,
      );

      navigate(`/dashboard/inventory/${result.extinguisherId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace extinguisher.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="shrink-0 flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Replace Extinguisher</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Confirm the old unit, then enter the new extinguisher information for this active record.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close replace extinguisher dialog"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
              Old extinguisher being replaced
            </h3>
            <div className="mt-3 grid gap-2 text-sm text-amber-950 sm:grid-cols-2">
              <p>Asset ID: <span className="font-mono font-medium">{oldAssetId || '—'}</span></p>
              <p>Serial: <span className="font-mono font-medium">{oldExtinguisher.serial || '—'}</span></p>
              <p>Barcode: <span className="font-mono font-medium">{oldExtinguisher.barcode || '—'}</span></p>
              <p>Type: <span className="font-medium">{oldExtinguisher.extinguisherType || '—'}</span></p>
              <p>Size: <span className="font-medium">{oldExtinguisher.extinguisherSize || '—'}</span></p>
              <p>Manufacture year: <span className="font-medium">{oldExtinguisher.manufactureYear ?? '—'}</span></p>
              <p className="sm:col-span-2">
                Location: <span className="font-medium">
                  {[oldExtinguisher.parentLocation, oldExtinguisher.section, oldExtinguisher.vicinity]
                    .filter(Boolean)
                    .join(' / ') || '—'}
                </span>
              </p>
            </div>
            <p className="mt-3 text-xs text-amber-800">
              This information will be archived automatically, so you do not need to copy old serial or barcode details
              into notes.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-900">Asset ID choice</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm">
                <input
                  type="radio"
                  name="assetMode"
                  checked={assetMode === 'reuse'}
                  onChange={() => {
                    setAssetMode('reuse');
                    setNewAssetId(oldAssetId);
                  }}
                  className="mt-0.5 h-4 w-4 border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <span className="block font-medium text-gray-900">Reuse existing asset/location ID</span>
                  <span className="block text-gray-500">
                    Keep <span className="font-mono">{oldAssetId}</span> tied to the location and move its barcode to
                    the new extinguisher.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm">
                <input
                  type="radio"
                  name="assetMode"
                  checked={assetMode === 'replace'}
                  onChange={() => setAssetMode('replace')}
                  className="mt-0.5 h-4 w-4 border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="flex-1">
                  <span className="block font-medium text-gray-900">Replace asset ID number</span>
                  <span className="block text-gray-500">Use this when the location/asset barcode also changes.</span>
                  {assetMode === 'replace' && (
                    <input
                      type="text"
                      value={newAssetId}
                      onChange={(e) => setNewAssetId(e.target.value)}
                      placeholder="New asset ID"
                      className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  )}
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              New Serial Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g., SN-12345678"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New Barcode</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Leave blank to clear barcode"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Manufacturer</label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g., Kidde, Amerex"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Extinguisher Type</label>
            <select
              value={extinguisherType}
              onChange={(e) => setExtinguisherType(e.target.value)}
              aria-label="Extinguisher type"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="">Select type...</option>
              <option value="ABC">ABC</option>
              <option value="BC">BC</option>
              <option value="CO2">CO2</option>
              <option value="Water">Water</option>
              <option value="WetChemical">Wet Chemical</option>
              <option value="Foam">Foam</option>
              <option value="CleanAgent">Clean Agent</option>
              <option value="Halon">Halon</option>
              <option value="ClassD">Class D</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Service class</label>
            <input
              type="text"
              value={serviceClass}
              onChange={(e) => setServiceClass(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Size</label>
            <input
              type="text"
              value={extinguisherSize}
              onChange={(e) => setExtinguisherSize(e.target.value)}
              placeholder="e.g., 5 lb"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Manufacture year</label>
              <input
                type="text"
                inputMode="numeric"
                value={manufactureYear}
                onChange={(e) => setManufactureYear(e.target.value)}
                placeholder="e.g., 2024"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Expiration year</label>
              <input
                type="text"
                inputMode="numeric"
                value={expirationYear}
                onChange={(e) => setExpirationYear(e.target.value)}
                placeholder="e.g., 2029"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-900 uppercase tracking-wide">Service History</h3>
            <p className="mb-4 text-sm text-gray-500">
              Check these only when the replacement unit was just serviced. This resets the next due date from today.
            </p>
            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={sixYearServiceCompleted}
                  onChange={(e) => setSixYearServiceCompleted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <span className="block font-medium text-gray-900">6-year maintenance completed</span>
                  <span className="block text-gray-500">
                    Records today as the last 6-year maintenance date for this extinguisher.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={hydroServiceCompleted}
                  onChange={(e) => setHydroServiceCompleted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <span className="block font-medium text-gray-900">Hydro test completed</span>
                  <span className="block text-gray-500">
                    Records today as the last hydrostatic test date for this extinguisher.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reason for Replacement</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Damaged, Expired, Upgrade"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Replace Extinguisher
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
