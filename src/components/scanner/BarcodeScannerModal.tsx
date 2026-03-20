/**
 * Camera barcode / QR scanner modal.
 * Uses html5-qrcode for live camera scanning with fallback to manual entry.
 * Plan-gated: requires cameraBarcodeScan or qrScanning feature flag.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, CameraOff, Keyboard, SwitchCamera, Zap, ZapOff } from 'lucide-react';

export interface ScanResult {
  text: string;
  format: string;
}

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: ScanResult) => void;
}

const SCANNER_REGION_ID = 'barcode-scanner-region';

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODE_93,
];

export default function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // state 2 = SCANNING, state 3 = PAUSED
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async (cameraId?: string) => {
    await stopScanner();
    setError(null);
    scannedRef.current = false;

    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices.length === 0) {
        setError('No cameras found. Please check permissions.');
        return;
      }
      setCameras(devices);

      const scanner = new Html5Qrcode(SCANNER_REGION_ID, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      const selectedCamera = cameraId ?? devices[activeCameraIdx]?.id ?? devices[0].id;

      await scanner.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.0,
        },
        (decodedText, result) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          const format = result.result.format?.formatName ?? 'UNKNOWN';
          onScan({ text: decodedText, format });
        },
        () => {
          // scan failure per frame — ignore
        },
      );

      // Check torch support
      try {
        const settings = scanner.getRunningTrackSettings();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setHasTorch(!!(settings as any)?.torch !== undefined);
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Permission') || message.includes('NotAllowed')) {
        setError('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else {
        setError(`Could not start camera: ${message}`);
      }
    }
  }, [activeCameraIdx, onScan, stopScanner]);

  // Start/stop scanner when modal opens/closes
  useEffect(() => {
    if (open && !manualMode) {
      // Small delay to let DOM mount
      const timer = setTimeout(() => { void startScanner(); }, 100);
      return () => {
        clearTimeout(timer);
        void stopScanner();
      };
    } else {
      void stopScanner();
    }
    return () => { void stopScanner(); };
  }, [open, manualMode, startScanner, stopScanner]);

  function handleSwitchCamera() {
    const nextIdx = (activeCameraIdx + 1) % cameras.length;
    setActiveCameraIdx(nextIdx);
    void startScanner(cameras[nextIdx].id);
  }

  async function handleToggleTorch() {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        advanced: [{ torch: !torchOn } as any],
      } as MediaTrackConstraints);
      setTorchOn(!torchOn);
    } catch {
      // torch not supported
    }
  }

  function handleManualSubmit() {
    const trimmed = manualValue.trim();
    if (!trimmed) return;
    onScan({ text: trimmed, format: 'MANUAL' });
  }

  function handleClose() {
    setManualMode(false);
    setManualValue('');
    setError(null);
    setTorchOn(false);
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
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                  <CameraOff className="mx-auto mb-2 h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => void startScanner()}
                    className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {/* Scanner viewport */}
                  <div className="relative overflow-hidden rounded-lg bg-black">
                    <div id={SCANNER_REGION_ID} className="w-full" />
                  </div>

                  <p className="text-center text-xs text-gray-500">
                    Point your camera at a barcode or QR code
                  </p>

                  {/* Camera controls */}
                  <div className="flex justify-center gap-3">
                    {cameras.length > 1 && (
                      <button
                        onClick={handleSwitchCamera}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <SwitchCamera className="h-4 w-4" />
                        Switch
                      </button>
                    )}
                    {hasTorch && (
                      <button
                        onClick={() => { void handleToggleTorch(); }}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {torchOn ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                        {torchOn ? 'Flash Off' : 'Flash On'}
                      </button>
                    )}
                  </div>
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
