/**
 * ScanSearchBar — barcode/serial/asset-ID text search + camera scan button.
 * Text search is available on all plans.
 * Camera scan button is gated by the `cameraBarcodeScan` feature flag (Pro+).
 *
 * Author: built_by_Beck
 */

import { useState, useRef } from 'react';
import { Search, Camera, Loader2 } from 'lucide-react';
import { hasFeature } from '../../lib/planConfig.ts';
import type { OrgFeatureFlags } from '../../types/organization.ts';
import { findExtinguisherByCode, type Extinguisher } from '../../services/extinguisherService.ts';
import BarcodeScannerModal from './BarcodeScannerModal.tsx';
import type { ScanResult } from './BarcodeScannerModal.tsx';

export interface ScanSearchNotFoundEvent {
  code: string;
  source: 'search' | 'scan';
  format?: string | null;
}

interface ScanSearchBarProps {
  orgId: string;
  onExtinguisherFound: (ext: Extinguisher) => void;
  onNotFound?: (event: ScanSearchNotFoundEvent) => void;
  featureFlags?: OrgFeatureFlags | null;
  plan?: string | null;
  placeholder?: string;
}

export function ScanSearchBar({
  orgId,
  onExtinguisherFound,
  onNotFound,
  featureFlags,
  plan,
  placeholder = 'Type barcode, serial, or asset ID...',
}: ScanSearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const flags = featureFlags as Record<string, boolean> | null | undefined;
  const canScan = hasFeature(flags, 'cameraBarcodeScan', plan) || hasFeature(flags, 'qrScanning', plan);

  async function handleSearch(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const ext = await findExtinguisherByCode(orgId, trimmed);
      if (ext) {
        setInputValue('');
        onExtinguisherFound(ext);
      } else {
        setError(`No extinguisher found for "${trimmed}"`);
        onNotFound?.({ code: trimmed, source: 'search', format: null });
      }
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void handleSearch(inputValue);
    }
  }

  async function handleScanResult(result: ScanResult) {
    setScannerOpen(false);
    setLoading(true);
    setError(null);

    try {
      const ext = await findExtinguisherByCode(orgId, result.text);
      if (ext) {
        setInputValue('');
        onExtinguisherFound(ext);
      } else {
        setError(`No extinguisher found for "${result.text}"`);
        onNotFound?.({ code: result.text, source: 'scan', format: result.format });
      }
    } catch {
      setError('Scan lookup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500">
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none disabled:cursor-not-allowed"
        />

        <button
          onClick={() => void handleSearch(inputValue)}
          disabled={loading || !inputValue.trim()}
          className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Search
        </button>

        {canScan && (
          <button
            onClick={() => setScannerOpen(true)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Scan barcode"
          >
            <Camera className="h-3.5 w-3.5" />
            Scan
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
      />
    </div>
  );
}
