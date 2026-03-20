/**
 * Camera barcode / QR scanner modal.
 * Uses @zxing/browser BrowserMultiFormatReader for live camera scanning
 * with fallback to manual entry.
 * Plan-gated: requires cameraBarcodeScan or qrScanning feature flag.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { BarcodeFormat } from '@zxing/library';
import { X, Camera, CameraOff, Keyboard } from 'lucide-react';

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
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannedRef = useRef(false);

  const stopScanner = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanning = async (reader: BrowserMultiFormatReader) => {
    if (!videoRef.current) return;

    try {
      setIsScanning(true);
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            if (scannedRef.current) return;
            scannedRef.current = true;
            const text = result.getText();
            const format = BarcodeFormat[result.getBarcodeFormat()] ?? 'UNKNOWN';
            onScan({ text, format });
            stopScanner();
          }
          if (err && err.name !== 'NotFoundException') {
            console.error('Scanning error:', err);
          }
        },
      );
      // Assign controls to ref immediately so stopScanner() can clean up.
      // The callback above fires per-frame AFTER this promise resolves,
      // so controlsRef.current is guaranteed to be set before any scan result
      // triggers stopScanner().
      controlsRef.current = controls;
    } catch (err) {
      console.error('Failed to start scanning:', err);
      setError('Failed to start camera scanning.');
      setIsScanning(false);
    }
  };

  const initializeScanner = async () => {
    setError(null);
    setHasPermission(null);
    scannedRef.current = false;

    try {
      // Request camera permission to verify access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      // Permission granted — stop the test stream
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);

      // BrowserMultiFormatReader will open its own stream via decodeFromVideoDevice
      const reader = new BrowserMultiFormatReader();
      // The <video> element is conditionally rendered only when hasPermission === true.
      // setTimeout(0) defers to the next macrotask, giving React time to flush the
      // setHasPermission(true) state update and render the <video> into the DOM.
      // Without this, videoRef.current would still be null when startScanning runs.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await startScanning(reader);
    } catch (err) {
      console.error('Camera initialization error:', err);
      setHasPermission(false);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access in your browser settings and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError(`Error accessing camera: ${err.message}`);
        }
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
              {/* Loading — requesting permission */}
              {hasPermission === null && !error && (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-red-600" />
                  <p className="text-sm text-gray-500">Requesting camera permission...</p>
                </div>
              )}

              {/* Permission denied */}
              {hasPermission === false && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                  <CameraOff className="mx-auto mb-2 h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => void initializeScanner()}
                    className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Permission granted — show video */}
              {hasPermission === true && (
                <>
                  {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                      <CameraOff className="mx-auto mb-2 h-8 w-8 text-red-400" />
                      <p className="text-sm text-red-700">{error}</p>
                      <button
                        onClick={() => void initializeScanner()}
                        className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Scanner viewport */}
                      <div className="relative overflow-hidden rounded-lg bg-black">
                        <video
                          ref={videoRef}
                          className="h-64 w-full rounded-lg object-cover"
                          autoPlay
                          playsInline
                          muted
                        />
                        {isScanning && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-36 w-48 rounded-lg border-2 border-red-500 animate-pulse" />
                          </div>
                        )}
                      </div>

                      <p className="text-center text-xs text-gray-500">
                        Point your camera at a barcode or QR code
                      </p>
                    </>
                  )}
                </>
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
