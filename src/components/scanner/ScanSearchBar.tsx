/**
 * ScanSearchBar — barcode/serial/asset-ID text search + camera scan button.
 * Text search is available on all plans.
 * Camera scanning is a Pro+ feature; Basic plans still see the Scan button and
 * get an upgrade prompt instead of the camera modal.
 *
 * Author: built_by_Beck
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Camera, Loader2, X, Sparkles } from 'lucide-react';
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
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const flags = featureFlags as Record<string, boolean> | null | undefined;
  const canScan = hasFeature(flags, 'cameraBarcodeScan', plan) || hasFeature(flags, 'qrScanning', plan);
  const showScanTeaser = plan === 'basic' && !canScan;
  const showScanButton = canScan || showScanTeaser;

  function handleScanClick() {
    if (canScan) {
      setScannerOpen(true);
      return;
    }
    if (showScanTeaser) {
      setUpgradeModalOpen(true);
    }
  }

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

        {showScanButton && (
          <button
            type="button"
            onClick={handleScanClick}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={canScan ? 'Scan barcode' : 'Scan barcode — Pro feature'}
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

      {upgradeModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-upgrade-title"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                  <Camera className="h-5 w-5 text-red-600" />
                </div>
                <h2 id="scan-upgrade-title" className="text-lg font-semibold text-gray-900">
                  Upgrade to Pro
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-gray-600">
                Camera barcode scanning is included with <strong>Pro</strong> and higher. Upgrade to unlock
                scanning plus the AI compliance assistant, QR scanning, GPS and photo capture on
                inspections, tag printing, inspection routes, and more.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
                  <span>AI assistant for compliance questions and inventory insights</span>
                </li>
                <li className="flex gap-2">
                  <Camera className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                  <span>Camera barcode and QR scanning for faster lookups</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden />
                  <span>Higher asset limits and the rest of the Pro feature set</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-2 border-t border-gray-200 px-4 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  setUpgradeModalOpen(false);
                  navigate('/dashboard/settings');
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                View plans &amp; billing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
