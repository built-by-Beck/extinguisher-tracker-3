/**
 * ReplaceExtinguisherModal
 * Form to replace an extinguisher with a new unit.
 * Validates new assetId uniqueness, calls replaceExtinguisher Cloud Function.
 * On success, navigates to the new extinguisher's edit page.
 *
 * Author: built_by_Beck
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2 } from 'lucide-react';
import { isSerialTaken } from '../../services/extinguisherService.ts';
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

  const [assetId, setAssetId] = useState(oldAssetId);
  const [serial, setSerial] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [extinguisherType, setExtinguisherType] = useState('');
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
      // Validate serial number uniqueness — serial must be different from any active extinguisher
      const serialInUse = await isSerialTaken(orgId, serial.trim());
      if (serialInUse) {
        setError(`Serial number "${serial.trim()}" is already in use by another extinguisher.`);
        setSubmitting(false);
        return;
      }

      const result = await replaceExtinguisher(
        orgId,
        oldExtinguisherId,
        {
          // Keep original asset ID by default if user leaves the field blank.
          assetId: assetId.trim() || oldAssetId,
          serial: serial.trim(),
          manufacturer: manufacturer.trim() || null,
          extinguisherType: extinguisherType || null,
          notes: notes.trim() || null,
        },
        reason.trim() || undefined,
      );

      navigate(`/dashboard/inventory/${result.newExtinguisherId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace extinguisher.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Replace Extinguisher</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Replacing {oldAssetId} with a new unit
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asset ID (prefilled from current unit)
            </label>
            <input
              type="text"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="e.g., EXT-1001"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Keep this the same in most replacements, or edit it if needed.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manufacturer
            </label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g., Kidde, Amerex"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extinguisher Type
            </label>
            <select
              value={extinguisherType}
              onChange={(e) => setExtinguisherType(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Replacement
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Damaged, Expired, Upgrade"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {/* Actions */}
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
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
