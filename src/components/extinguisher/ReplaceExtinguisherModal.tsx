/**
 * ReplaceExtinguisherModal
 * In-place replacement: updates serial/barcode and physical fields on the same document.
 *
 * Author: built_by_Beck
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2 } from 'lucide-react';
import { isSerialTaken, isBarcodeTaken } from '../../services/extinguisherService.ts';
import { replaceExtinguisher } from '../../services/lifecycleService.ts';

interface ReplaceExtinguisherModalProps {
  orgId: string;
  oldExtinguisherId: string;
  oldAssetId: string;
  onClose: () => void;
}

export function ReplaceExtinguisherModal({
  orgId,
  oldExtinguisherId,
  oldAssetId,
  onClose,
}: ReplaceExtinguisherModalProps) {
  const navigate = useNavigate();

  const [serial, setSerial] = useState('');
  const [barcode, setBarcode] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [extinguisherType, setExtinguisherType] = useState('');
  const [serviceClass, setServiceClass] = useState('');
  const [extinguisherSize, setExtinguisherSize] = useState('');
  const [manufactureYear, setManufactureYear] = useState('');
  const [expirationYear, setExpirationYear] = useState('');
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
        assetId: oldAssetId,
        serial: serial.trim(),
        barcode: barcode.trim() || null,
        manufacturer: manufacturer.trim() || null,
        extinguisherType: extinguisherType || null,
        serviceClass: serviceClass.trim() || null,
        extinguisherSize: extinguisherSize.trim() || null,
        manufactureYear: my != null && !Number.isNaN(my) ? my : null,
        expirationYear: ey != null && !Number.isNaN(ey) ? ey : null,
        notes: notes.trim() || null,
      };

      const result = await replaceExtinguisher(
        orgId,
        oldExtinguisherId,
        newExtinguisherData,
        reason.trim() || undefined,
      );

      // #region agent log
      fetch('http://127.0.0.1:7590/ingest/60982b77-4867-44d4-bb0e-2b2e4905ad1d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6badb8' },
        body: JSON.stringify({
          sessionId: '6badb8',
          location: 'ReplaceExtinguisherModal.tsx:handleSubmit',
          message: 'replace_success',
          data: { extinguisherId: result.extinguisherId },
          timestamp: Date.now(),
          hypothesisId: 'H2',
        }),
      }).catch(() => {});
      // #endregion

      navigate(`/dashboard/inventory/${result.extinguisherId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace extinguisher.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Replace Extinguisher</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Update physical unit for asset <span className="font-mono">{oldAssetId}</span> (same slot; new serial /
              barcode).
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

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Asset ID (slot)</label>
            <input
              type="text"
              value={oldAssetId}
              readOnly
              aria-label="Asset ID slot"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">Usually unchanged — this is the permanent location / slot ID.</p>
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
