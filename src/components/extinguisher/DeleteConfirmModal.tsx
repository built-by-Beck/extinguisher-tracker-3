import { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  assetId: string;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

export function DeleteConfirmModal({ assetId, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('Please provide a reason for deletion.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Extinguisher</h3>
              <p className="text-sm text-gray-500">Asset: {assetId}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          This will soft-delete the extinguisher. It can be viewed in the deleted items list but
          will no longer appear in the active inventory.
        </p>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mb-4">
          <label htmlFor="deleteReason" className="mb-1 block text-sm font-medium text-gray-700">
            Reason for deletion <span className="text-red-500">*</span>
          </label>
          <textarea
            id="deleteReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            placeholder="e.g., Replaced with newer unit, Damaged beyond repair..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
