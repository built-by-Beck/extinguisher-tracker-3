import { AlertTriangle, CheckCircle, Loader2, X, Copy } from 'lucide-react';
import { type DuplicateGroup } from '../../services/duplicateService.ts';
import { formatDueDate } from '../../utils/compliance.ts';

interface DuplicateScanModalProps {
  open: boolean;
  groups: DuplicateGroup[];
  scanning: boolean;
  onMerge: () => void;
  onCancel: () => void;
  merging: boolean;
}

export function DuplicateScanModal({
  open,
  groups,
  scanning,
  onMerge,
  onCancel,
  merging,
}: DuplicateScanModalProps) {
  if (!open) return null;

  const totalDuplicates = groups.reduce((acc, g) => acc + g.remove.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Duplicate Cleanup</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {scanning ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
              <p className="mt-4 text-lg font-medium text-gray-900">Scanning for duplicates...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <h3 className="mt-4 text-lg font-bold text-gray-900">No duplicates found</h3>
              <p className="mt-2 text-gray-500">Your inventory is clean! All Asset IDs are unique.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      Found {groups.length} Asset ID(s) with duplicates.
                    </p>
                    <p className="mt-1 text-sm text-amber-800">
                      Total extra records: {totalDuplicates}. Merging will consolidate all data (photos, history, dates) into the most complete record and remove the redundant ones.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.assetId} className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
                    <div className="bg-white border-b border-gray-200 px-4 py-3">
                      <span className="text-sm font-bold text-gray-900">Asset ID: {group.assetId}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Keep row */}
                      <div className="flex items-start gap-3 rounded-md bg-white p-3 border border-green-100 shadow-sm">
                        <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-bold text-green-700">KEEP</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            ID: {group.keep.id?.slice(0, 8)}... • {group.keep.category} • {group.keep.complianceStatus}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Last Inspection: {formatDueDate(group.keep.lastMonthlyInspection)}
                          </p>
                        </div>
                      </div>

                      {/* Remove rows */}
                      {group.remove.map((rm) => (
                        <div key={rm.id} className="flex items-start gap-3 rounded-md bg-white p-3 border border-red-50 shadow-sm">
                          <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">REMOVE</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              ID: {rm.id?.slice(0, 8)}... • {rm.category} • {rm.complianceStatus}
                            </p>
                            <p className="mt-0.5 text-xs text-red-500 italic">
                              Redundant record — will be merged and soft-deleted.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={merging}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {groups.length > 0 && !scanning && (
            <button
              onClick={onMerge}
              disabled={merging}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50"
            >
              {merging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                'Merge & Remove Duplicates'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
