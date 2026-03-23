import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  ShieldCheck,
  Camera,
  MapPin,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  X,
  WifiOff,
} from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useOffline } from '../hooks/useOffline.ts';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { storage } from '../lib/firebase.ts';
import {
  getInspection,
  getInspectionHistoryForExtinguisher,
  saveInspectionOfflineAware,
  resetInspectionCall,
  CHECKLIST_SECTIONS,
  CHECKLIST_ITEMS,
  EMPTY_CHECKLIST,
  type Inspection,
  type ChecklistData,
} from '../services/inspectionService.ts';
import { getCachedInspectionsForWorkspace } from '../services/offlineCacheService.ts';

type CheckValue = 'pass' | 'fail' | 'n/a';

interface GpsData {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  capturedAt: string;
}

function ChecklistRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: CheckValue;
  onChange: (v: CheckValue) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-1">
        {(['pass', 'fail', 'n/a'] as CheckValue[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            disabled={disabled}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              value === v
                ? v === 'pass'
                  ? 'bg-green-500 text-white'
                  : v === 'fail'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            {v === 'n/a' ? 'N/A' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function InspectionForm() {
  const navigate = useNavigate();
  const { workspaceId, inspectionId } = useParams<{ workspaceId: string; inspectionId: string }>();
  const { user, userProfile } = useAuth();
  const { hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canInspect = hasRole(['owner', 'admin', 'inspector']);
  const canReset = hasRole(['owner', 'admin']);
  const { isOnline } = useOffline();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistData>({ ...EMPTY_CHECKLIST });
  const [notes, setNotes] = useState('');

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GPS state
  const [gps, setGps] = useState<GpsData | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Inspection history state
  const [history, setHistory] = useState<Inspection[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId || !inspectionId) return;

    // Reset state for new inspection (lessons-learned rule)
    setInspection(null);
    setChecklist({ ...EMPTY_CHECKLIST });
    setNotes('');
    setPhotoFile(null);
    setPhotoPreview('');
    setGps(null);
    setHistory([]);
    setExpandedHistoryIdx(null);
    setError('');
    setSuccessMsg('');
    setLoading(true);

    getInspection(orgId, inspectionId)
      .then((insp) => {
        setInspection(insp);
        if (insp?.checklistData) {
          setChecklist(insp.checklistData);
        }
        if (insp?.notes) {
          setNotes(insp.notes);
        }
        if (insp?.gps) {
          setGps(insp.gps as GpsData);
        }
        setLoading(false);

        // Fetch inspection history
        if (insp?.extinguisherId) {
          setHistoryLoading(true);
          getInspectionHistoryForExtinguisher(orgId, insp.extinguisherId, 10)
            .then((items) => {
              // Filter out the current inspection
              setHistory(items.filter((h) => h.id !== inspectionId));
            })
            .catch(() => {
              // History fetch failed silently — non-critical
            })
            .finally(() => setHistoryLoading(false));
        }
      })
      .catch(async () => {
        // On network error when offline, fall back to IndexedDB cache
        if (!isOnline && workspaceId) {
          try {
            const cached = await getCachedInspectionsForWorkspace(orgId, workspaceId);
            const match = cached.find((c) => c['id'] === inspectionId);
            if (match) {
              const insp = match as unknown as Inspection;
              setInspection(insp);
              if (insp.checklistData) {
                setChecklist(insp.checklistData);
              }
              if (insp.notes) {
                setNotes(insp.notes);
              }
              if (insp.gps) {
                setGps(insp.gps as GpsData);
              }
            }
          } catch {
            // Cache read failed — leave inspection as null
          }
        }
        setLoading(false);
      });
  }, [orgId, inspectionId, workspaceId, isOnline]);

  // Cleanup photo preview object URL
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  function updateChecklist(key: keyof ChecklistData, value: CheckValue) {
    setChecklist((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function captureGps() {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported on this device/browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy, altitude, altitudeAccuracy } = pos.coords;
        setGps({
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
        setError('Unable to get GPS location. Please ensure location services are enabled.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  async function handleSave(status: 'pass' | 'fail') {
    if (!orgId || !inspectionId || !inspection) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      let photoUrl: string | null = null;
      let photoPath: string | null = null;

      // Upload photo if selected and online
      if (photoFile && isOnline) {
        const path = `org/${orgId}/inspections/${inspectionId}/photo_${Date.now()}.jpg`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, photoFile);
        photoUrl = await getDownloadURL(fileRef);
        photoPath = path;
      }

      const result = await saveInspectionOfflineAware(
        orgId,
        inspectionId,
        inspection.extinguisherId,
        inspection.workspaceId,
        {
          status,
          checklistData: checklist,
          notes,
          photoUrl,
          photoPath,
          gps: gps ?? null,
          attestation: {
            confirmed: true,
            text: 'I certify this inspection was performed according to NFPA 10 standards.',
            inspectorName: user?.displayName ?? user?.email ?? 'Unknown',
          },
        },
        isOnline,
      );

      if (result.synced) {
        setSuccessMsg(`Inspection marked as ${status}.`);
        // Reload inspection data from server
        const updated = await getInspection(orgId, inspectionId);
        setInspection(updated);
        // Refresh history
        if (inspection.extinguisherId) {
          getInspectionHistoryForExtinguisher(orgId, inspection.extinguisherId, 10)
            .then((items) => setHistory(items.filter((h) => h.id !== inspectionId)))
            .catch(() => {});
        }
      } else {
        setSuccessMsg(
          'Inspection saved locally. It will sync when you\'re back online.' +
          (photoFile ? ' Photo will be uploaded when online.' : ''),
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save inspection.');
    } finally {
      setSaving(false);
    }
  }

  function requestReset() {
    if (!orgId || !inspectionId) return;
    setConfirmResetOpen(true);
  }

  const executeReset = useCallback(async () => {
    if (!orgId || !inspectionId) return;
    setConfirmResetOpen(false);
    setResetting(true);
    setError('');

    try {
      await resetInspectionCall(orgId, inspectionId);
      setChecklist({ ...EMPTY_CHECKLIST });
      setNotes('');
      setPhotoFile(null);
      setPhotoPreview('');
      setGps(null);
      setSuccessMsg('Inspection reset to pending.');
      const updated = await getInspection(orgId, inspectionId);
      setInspection(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset inspection.');
    } finally {
      setResetting(false);
    }
  }, [orgId, inspectionId]);

  function formatDate(timestamp: unknown): string {
    if (!timestamp) return 'Unknown';
    if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    }
    return 'Unknown';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!inspection) {
    return <div className="p-6 text-sm text-gray-500">Inspection not found.</div>;
  }

  const isCompleted = inspection.status === 'pass' || inspection.status === 'fail';

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/dashboard/workspaces/${workspaceId}`)}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Workspace
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Inspect: {inspection.assetId}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Section: {inspection.section || 'None'} | Status:{' '}
              <span className={
                inspection.status === 'pass' ? 'font-semibold text-green-600' :
                inspection.status === 'fail' ? 'font-semibold text-red-600' :
                'text-gray-600'
              }>
                {inspection.status.charAt(0).toUpperCase() + inspection.status.slice(1)}
              </span>
            </p>
          </div>

          {/* Reset button */}
          {isCompleted && canReset && (
            <button
              onClick={requestReset}
              disabled={resetting}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reset to Pending
            </button>
          )}
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline. Viewing cached data. Photos cannot be uploaded while offline.
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {successMsg && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{successMsg}</p>
      )}

      {/* NFPA 13-Point Checklist — Categorized Sections */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold text-gray-900">NFPA 10 Inspection Checklist</h2>
        </div>

        {CHECKLIST_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <h3 className="mb-2 border-b border-gray-200 pb-1 text-sm font-semibold uppercase tracking-wider text-gray-500">
              {section.title}
            </h3>
            {section.items.map((item) => (
              <ChecklistRow
                key={item.key}
                label={item.label}
                value={checklist[item.key] as CheckValue}
                onChange={(v) => updateChecklist(item.key, v)}
                disabled={isCompleted || !canInspect}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          disabled={isCompleted || !canInspect}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100"
          placeholder="Add inspection notes..."
        />
      </div>

      {/* Photo Capture */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Photo</h2>

        {!isCompleted && canInspect && (
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Camera className="h-4 w-4" />
              {photoFile ? 'Change Photo' : 'Take / Upload Photo'}
            </button>

            {photoFile && (
              <button
                type="button"
                onClick={removePhoto}
                className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <X className="h-3 w-3" />
                Remove
              </button>
            )}
          </div>
        )}

        {/* Photo preview */}
        {photoPreview && (
          <div className="mt-3">
            <img
              src={photoPreview}
              alt="Inspection photo preview"
              className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
            />
          </div>
        )}

        {/* Existing photo (completed inspection) */}
        {!photoPreview && inspection.photoUrl && (
          <div className="mt-1">
            <img
              src={inspection.photoUrl}
              alt="Inspection photo"
              className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
            />
          </div>
        )}

        {!photoPreview && !inspection.photoUrl && isCompleted && (
          <p className="text-sm text-gray-400">No photo attached.</p>
        )}
      </div>

      {/* GPS Capture */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">GPS Location</h2>

        {!isCompleted && canInspect && !gps && (
          <button
            type="button"
            onClick={captureGps}
            disabled={gpsLoading}
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
                onClick={() => setGps(null)}
                className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        )}

        {!gps && isCompleted && (
          <p className="text-sm text-gray-400">No GPS data captured.</p>
        )}
      </div>

      {/* Attestation notice */}
      {canInspect && !isCompleted && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-700">
            By marking this inspection as Pass or Fail, you certify that this inspection was
            performed according to NFPA 10 standards.
          </p>
        </div>
      )}

      {/* Action buttons */}
      {canInspect && !isCompleted && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave('pass')}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Pass
          </button>
          <button
            onClick={() => handleSave('fail')}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-5 w-5" />}
            Fail
          </button>
        </div>
      )}

      {/* Completed info */}
      {isCompleted && inspection.inspectedByEmail && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            Inspected by <span className="font-medium">{inspection.inspectedByEmail}</span>
          </p>
        </div>
      )}

      {/* Inspection History */}
      {(history.length > 0 || historyLoading) && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Inspection History ({history.length})
          </h2>

          {historyLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history...
            </div>
          )}

          <div className="space-y-3">
            {history.map((entry, idx) => (
              <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {entry.status === 'pass' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      entry.status === 'pass' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(entry.inspectedAt)}
                    </span>
                  </div>

                  {entry.checklistData && (
                    <button
                      type="button"
                      onClick={() => setExpandedHistoryIdx(expandedHistoryIdx === idx ? null : idx)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      {expandedHistoryIdx === idx ? 'Hide' : 'View'} Checklist
                      {expandedHistoryIdx === idx ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {entry.inspectedByEmail && (
                  <p className="mt-1 text-xs text-gray-500">
                    By: {entry.inspectedByEmail}
                  </p>
                )}

                {entry.notes && (
                  <p className="mt-1 text-xs text-gray-600">{entry.notes}</p>
                )}

                {entry.photoUrl && (
                  <img
                    src={entry.photoUrl}
                    alt="Inspection photo"
                    className="mt-2 h-16 w-16 rounded border border-gray-200 object-cover"
                  />
                )}

                {/* Expanded checklist details */}
                {expandedHistoryIdx === idx && entry.checklistData && (
                  <div className="mt-3 rounded-md bg-white p-3 text-sm">
                    {CHECKLIST_ITEMS.map((item) => {
                      const val = entry.checklistData?.[item.key] ?? 'n/a';
                      return (
                        <div key={item.key} className="flex items-center justify-between border-b border-gray-50 py-1.5 last:border-0">
                          <span className="text-gray-600">{item.label}</span>
                          <span className={`text-xs font-medium ${
                            val === 'pass' ? 'text-green-600' :
                            val === 'fail' ? 'text-red-600' :
                            'text-gray-400'
                          }`}>
                            {val === 'n/a' ? 'N/A' : val.charAt(0).toUpperCase() + val.slice(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmResetOpen}
        title="Reset Inspection"
        message="Reset this inspection to pending? This action is logged."
        confirmLabel="Reset"
        variant="warning"
        onConfirm={executeReset}
        onCancel={() => setConfirmResetOpen(false)}
        loading={resetting}
      />
    </div>
  );
}
