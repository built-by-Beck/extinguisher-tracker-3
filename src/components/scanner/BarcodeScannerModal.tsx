/**
 * Camera barcode / QR scanner modal.
 * Uses a framework-agnostic scanner (BarcodeDetector with polyfill) from src/lib/barcodeScanner.
 * Includes manual entry mode. Stops on first successful read.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useRef } from 'react';
import { X, Camera, CameraOff, Keyboard } from 'lucide-react';
import createBarcodeScanner, { type Scanner } from '../../lib/barcodeScanner.ts';

export interface ScanResult {
  text: string;
  format: string;
}

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: ScanResult) => void;
}

export default function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState('');
  // null = loading/requesting, true = granted, false = denied
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const scannedRef = useRef(false);

  function stopScanner() {
    scannerRef.current?.stop();
    setIsScanning(false);
  }

  const initializeScanner = async () => {
    setError(null);
    setHasPermission(null);
    setIsScanning(false);
    scannedRef.current = false;

    try {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      if (!videoRef.current) throw new Error('Video element is not ready');
      const scanner = createBarcodeScanner({
        video: videoRef.current,
        canvas: canvasRef.current ?? undefined,
        onScan: (text, code) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          onScan({ text: text.trim(), format: code?.format ?? 'unknown' });
          stopScanner();
        },
        onError: (scanError) => {
          setIsScanning(false);
          setError(scanError.message);
        },
      });
      scannerRef.current = scanner;
      await scanner.init();
      await scanner.start();
      setHasPermission(true);
      setIsScanning(true);
    } catch (err) {
      console.error('Camera initialization error:', err);
      setHasPermission(false);
      if (err instanceof Error) {
        const name = (err as { name?: string }).name || 'Error';
        if (name === 'NotAllowedError') setError('Camera permission denied. Please allow camera access and try again.');
        else if (name === 'NotFoundError') setError('No camera found on this device.');
        else if (name === 'NotSupportedError' || name === 'SecurityError') setError('Camera requires HTTPS (iOS Safari). Use a secure origin.');
        else if (name === 'NotReadableError') setError('Camera is busy. Close other apps and retry.');
        else setError(`Error accessing camera: ${err.message}`);
      } else {
        setError('An unknown error occurred while accessing the camera.');
      }
    }
  };

  // Start/stop scanner when modal opens/closes or manual mode changes
  useEffect(() => {
    if (open && !manualMode) {
      void initializeScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
    // initializeScanner is intentionally excluded — we only want to re-run when open/manualMode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, manualMode]);

  function handleManualSubmit() {
    const trimmed = manualValue.trim();
    if (!trimmed) return;
    onScan({ text: trimmed, format: 'MANUAL' });
  }

  function handleClose() {
    setManualMode(false);
    setManualValue('');
    setError(null);
    setHasPermission(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {manualMode ? 'Manual Entry' : 'Scan Barcode'}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {manualMode ? (
            /* Manual entry mode */
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Enter a barcode, asset ID, or serial number manually.
              </p>
              <input
                type="text"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Barcode, asset ID, or serial..."
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualValue.trim()}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Search
                </button>
                <button
                  onClick={() => setManualMode(false)}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Camera className="h-4 w-4" />
                  Camera
                </button>
              </div>
            </div>
          ) : (
            /* Camera scanner mode */
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  className="h-64 w-full rounded-lg object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 h-64 w-full"
                />

                {hasPermission === null && !error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white">
                    <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-red-500" />
                    <p className="text-sm">Requesting camera permission...</p>
                  </div>
                )}

                {hasPermission === false && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6 text-center">
                    <CameraOff className="mb-2 h-8 w-8 text-red-400" />
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                {hasPermission === true && error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6 text-center">
                    <CameraOff className="mb-2 h-8 w-8 text-red-400" />
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-36 w-48 animate-pulse rounded-lg border-2 border-red-500" />
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-gray-500">
                Point your camera at a barcode or QR code
              </p>

              {(hasPermission === false || (hasPermission === true && error)) && (
                <button
                  onClick={() => void initializeScanner()}
                  className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Try Again
                </button>
              )}

              {hasPermission === true && !error && (
                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={async () => {
                      try {
                        await scannerRef.current?.switchCamera();
                      } catch (e: unknown) {
                        if (e instanceof Error) setError(e.message);
                        else setError('Failed to switch camera');
                      }
                    }}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Switch Camera
                  </button>
                  <button
                    onClick={() => {
                      stopScanner();
                      void initializeScanner();
                    }}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Restart
                  </button>
                </div>
              )}

              {/* Manual fallback */}
              <button
                onClick={() => setManualMode(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Keyboard className="h-4 w-4" />
                Enter Manually
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
