import { useState, useRef } from 'react';
import { Upload, FileJson, CheckCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import { 
  parseAndValidateBackup, 
  importExtinguishers, 
  type ValidationResult, 
  type ImportResult 
} from '../../services/jsonImportService.ts';

interface DataImportModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  uid: string;
  assetLimit: number | null;
  currentCount: number;
}

export function DataImportModal({
  open,
  onClose,
  orgId,
  uid,
  assetLimit,
  currentCount,
}: DataImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError('');
    try {
      const text = await selectedFile.text();
      const result = parseAndValidateBackup(text);
      setValidation(result);
      if (result.valid) {
        setStep('preview');
      } else {
        setParseError(result.errors.join(' '));
      }
    } catch (err) {
      setParseError('Failed to read file.');
    }
  };

  const handleImport = async () => {
    if (!validation) return;
    setImporting(true);
    try {
      const result = await importExtinguishers(orgId, uid, validation.extinguishers, assetLimit);
      setImportResult(result);
      setStep('result');
    } catch (err) {
      setParseError('Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Import JSON Backup</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 transition-colors hover:bg-gray-100 cursor-pointer"
              >
                <Upload className="h-12 w-12 text-gray-400" />
                <p className="mt-4 text-sm font-medium text-gray-900">
                  {file ? file.name : 'Click or drag JSON file to upload'}
                </p>
                <p className="mt-1 text-xs text-gray-500">Only .json files from EX3 backups</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".json"
                  className="hidden"
                />
              </div>

              {parseError && (
                <div className="rounded-md bg-red-50 p-4 border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    <p className="text-sm text-red-800">{parseError}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && validation && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">Extinguishers found</p>
                  <p className="text-2xl font-bold text-gray-900">{validation.extinguishers.length}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">Asset Limit</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {assetLimit ? `${currentCount} / ${assetLimit}` : 'Unlimited'}
                  </p>
                </div>
              </div>

              {validation.warnings.length > 0 && (
                <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="text-sm text-amber-800 max-h-32 overflow-y-auto">
                      <p className="font-bold">Warnings:</p>
                      <ul className="list-disc pl-5 mt-1">
                        {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-700">Data Preview (first 10 items):</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Asset ID</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Serial</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {validation.extinguishers.slice(0, 10).map((ext, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-900">{ext.assetId}</td>
                          <td className="px-3 py-2 text-gray-600">{ext.serial}</td>
                          <td className="px-3 py-2 text-gray-600">{ext.extinguisherType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {validation.extinguishers.length > 10 && (
                  <p className="text-xs text-gray-500 text-center italic">...and {validation.extinguishers.length - 10} more</p>
                )}
              </div>
            </div>
          )}

          {step === 'result' && importResult && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <h3 className="mt-4 text-xl font-bold text-gray-900">Import Complete</h3>
              <div className="mt-6 grid grid-cols-2 gap-8">
                <div>
                  <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">Created</p>
                  <p className="text-3xl font-extrabold text-indigo-600">{importResult.created}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">Skipped</p>
                  <p className="text-3xl font-extrabold text-gray-400">{importResult.skipped}</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-6 rounded-md bg-red-50 p-4 border border-red-200 text-left w-full">
                  <p className="text-sm font-bold text-red-800">Errors/Notices:</p>
                  <ul className="list-disc pl-5 mt-1 text-sm text-red-700">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          {step !== 'result' ? (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              {step === 'preview' && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Confirm Import'
                  )}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 shadow-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
