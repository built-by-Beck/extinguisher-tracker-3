/**
 * QuickFailModal — captures required fail notes before marking an inspection failed.
 * Notes are required (minLength 3).
 *
 * Author: built_by_Beck
 */

import { useState } from 'react';
import { X, XCircle, Loader2 } from 'lucide-react';

interface QuickFailModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
  saving: boolean;
}

export function QuickFailModal({ open, onClose, onSubmit, saving }: QuickFailModalProps) {
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');

  if (!open) return null;

  function handleSubmit() {
    const trimmed = notes.trim();
    if (trimmed.length < 3) {
      setValidationError('Please provide at least a brief reason (3+ characters).');
      return;
    }
    setValidationError('');
    onSubmit(trimmed);
  }

  function handleClose() {
    if (saving) return;
    setNotes('');
    setValidationError('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Mark as Failed</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Why did this extinguisher fail? Notes are required for failed inspections.
          </p>

          <div>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (validationError) setValidationError('');
              }}
              rows={4}
              disabled={saving}
              placeholder="Describe the issue (e.g., gauge low, pin missing, damage observed)..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100"
              autoFocus
            />
            {validationError && (
              <p className="mt-1 text-xs text-red-600">{validationError}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Mark as Failed
            </button>
            <button
              onClick={handleClose}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
