/**
 * GpsCapture — captures and displays GPS coordinates for an inspection.
 * Shows altitude for multi-floor buildings (hospitals, warehouses).
 *
 * Author: built_by_Beck
 */

import { useState } from 'react';
import { MapPin, Loader2, ExternalLink, X } from 'lucide-react';

export interface GpsData {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  capturedAt: string;
}

interface GpsCaptureProps {
  gps: GpsData | null;
  onGpsChange: (gps: GpsData | null) => void;
  disabled: boolean;
  isCompleted: boolean;
  canInspect: boolean;
  onError?: (msg: string) => void;
}

export function GpsCapture({ gps, onGpsChange, disabled, isCompleted, canInspect, onError }: GpsCaptureProps) {
  const [gpsLoading, setGpsLoading] = useState(false);

  function captureGps() {
    if (!('geolocation' in navigator)) {
      onError?.('Geolocation not supported on this device/browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy, altitude, altitudeAccuracy } = pos.coords;
        onGpsChange({
          lat: latitude,
          lng: longitude,
          accuracy,
          altitude,
          altitudeAccuracy,
          capturedAt: new Date().toISOString(),
        });
        setGpsLoading(false);
      },
      () => {
        onError?.('Unable to get GPS location. Please ensure location services are enabled.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">GPS Location</h2>

      {!isCompleted && canInspect && !gps && (
        <button
          type="button"
          onClick={captureGps}
          disabled={disabled || gpsLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {gpsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          {gpsLoading ? 'Capturing...' : 'Capture GPS Location'}
        </button>
      )}

      {gps && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</span>
              <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                ±{Math.round(gps.accuracy)}m
              </span>
            </div>

            <a
              href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-3 w-3" />
              Open in Maps
            </a>

            {!isCompleted && canInspect && (
              <button
                type="button"
                onClick={() => onGpsChange(null)}
                disabled={disabled}
                className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          {/* Altitude display for multi-floor buildings */}
          {gps.altitude !== null && (
            <p className="text-xs text-gray-500">
              Floor elevation: {gps.altitude.toFixed(1)}m
              {gps.altitudeAccuracy !== null && (
                <span className="ml-1">(±{Math.round(gps.altitudeAccuracy)}m)</span>
              )}
            </p>
          )}
        </div>
      )}

      {!gps && isCompleted && (
        <p className="text-sm text-gray-400">No GPS data captured.</p>
      )}
    </div>
  );
}
