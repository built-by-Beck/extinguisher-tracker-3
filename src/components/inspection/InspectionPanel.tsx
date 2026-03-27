/**
 * InspectionPanel — reusable inspection component that composes ChecklistRow,
 * GpsCapture, PhotoCapture, notes, attestation, pass/fail, reset, and modals.
 *
 * Used by both ExtinguisherDetail and InspectionForm pages.
 * Manages its own internal state for checklist, notes, GPS, photo, saving, etc.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase.ts';
import { ChecklistRow, type CheckValue } from './ChecklistRow.tsx';
import { GpsCapture, type GpsData } from './GpsCapture.tsx';
import { PhotoCapture } from './PhotoCapture.tsx';
import { QuickFailModal } from '../scanner/QuickFailModal.tsx';
import { ConfirmModal } from '../ui/ConfirmModal.tsx';
import {
  saveInspectionOfflineAware,
  resetInspectionCall,
  CHECKLIST_SECTIONS,
  EMPTY_CHECKLIST,
  type Inspection,
  type ChecklistData,
} from '../../services/inspectionService.ts';

export interface InspectionPanelProps {
  // Identifiers
  orgId: string;
  extId: string;
  inspectionId: string;
  workspaceId: string;

  // Initial data
  inspection: Inspection;

  // Permissions
  canInspect: boolean;
  canReset: boolean;
  isOnline: boolean;

  // User info (for attestation)
  inspectorName: string;

  // Callbacks
  onInspectionUpdated: (updated: Inspection | null) => void;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export function InspectionPanel({
  orgId,
  extId,
  inspectionId,
  workspaceId,
  inspection,
  canInspect,
  canReset,
  isOnline,
  inspectorName,
  onInspectionUpdated,
  onError,
  onSuccess,
}: InspectionPanelProps) {
  // Internal state
  const [checklist, setChecklist] = useState<ChecklistData>(() =>
    inspection.checklistData ? { ...inspection.checklistData } : { ...EMPTY_CHECKLIST },
  );
  const [notes, setNotes] = useState(() => inspection.notes ?? '');
  const [gps, setGps] = useState<GpsData | null>(() => (inspection.gps as GpsData) ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [quickFailOpen, setQuickFailOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Re-sync internal state when the inspection identity or status changes
  // (e.g., navigating to a different inspection, or parent reloads after save/reset).
  // Keyed on id + status only — NOT on object fields like checklistData/notes/gps,
  // which would cause spurious resets and blow away in-progress edits when the parent
  // passes a new inspection object reference with identical content.
  useEffect(() => {
    setChecklist(inspection.checklistData ? { ...inspection.checklistData } : { ...EMPTY_CHECKLIST });
    setNotes(inspection.notes ?? '');
    setGps((inspection.gps as GpsData) ?? null);
    setPhotoFile(null);
    setPhotoPreview('');
    setActionError('');
    setSuccessMsg('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspection.id, inspection.status]);

  const isCompleted = inspection.status === 'pass' || inspection.status === 'fail';
  const isPending = inspection.status === 'pending';

  function updateChecklist(key: keyof ChecklistData, value: CheckValue) {
    setChecklist((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(status: 'pass' | 'fail', overrideNotes?: string) {
    if (!orgId || !inspectionId || !extId || !workspaceId) return;
    setSaving(true);
    setActionError('');
    setSuccessMsg('');

    const finalNotes = overrideNotes !== undefined ? overrideNotes : notes;

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
        extId,
        workspaceId,
        {
          status,
          checklistData: checklist,
          notes: finalNotes,
          photoUrl,
          photoPath,
          gps: gps ?? null,
          attestation: {
            confirmed: true,
            text: 'I certify this inspection was performed according to NFPA 10 standards.',
            inspectorName,
          },
        },
        isOnline,
      );

      if (result.synced) {
        const msg = `Inspection marked as ${status}.`;
        setSuccessMsg(msg);
        onSuccess?.(msg);
      } else {
        const msg =
          'Inspection saved locally. It will sync when you\'re back online.' +
          (photoFile ? ' Photo will be uploaded when online.' : '');
        setSuccessMsg(msg);
        onSuccess?.(msg);
      }

      // Notify parent to reload inspection + history
      onInspectionUpdated(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save inspection.';
      setActionError(msg);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  }

  function handlePassClick() {
    void handleSave('pass');
  }

  function handleFailClick() {
    // If notes already provided, save directly; otherwise open QuickFailModal
    if (notes.trim().length >= 3) {
      void handleSave('fail');
    } else {
      setQuickFailOpen(true);
    }
  }

  function handleQuickFailSubmit(failNotes: string) {
    setNotes(failNotes);
    setQuickFailOpen(false);
    void handleSave('fail', failNotes);
  }

  function requestReset() {
    if (!orgId || !inspectionId) return;
    setConfirmResetOpen(true);
  }

  const executeReset = useCallback(async () => {
    if (!orgId || !inspectionId) return;
    setConfirmResetOpen(false);
    setResetting(true);
    setActionError('');

    try {
      await resetInspectionCall(orgId, inspectionId);
      setChecklist({ ...EMPTY_CHECKLIST });
      setNotes('');
      setGps(null);
      setPhotoFile(null);
      setPhotoPreview('');
      setSuccessMsg('Inspection reset to pending.');
      onSuccess?.('Inspection reset to pending.');

      // Notify parent to reload
      onInspectionUpdated(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset inspection.';
      setActionError(msg);
      onError?.(msg);
    } finally {
      setResetting(false);
    }
  }, [orgId, inspectionId, onInspectionUpdated, onError, onSuccess]);

  function handleGpsError(msg: string) {
    setActionError(msg);
    onError?.(msg);
  }

  function handlePhotoSelect(file: File, preview: string) {
    setPhotoFile(file);
    setPhotoPreview(preview);
  }

  function handlePhotoRemove() {
    setPhotoFile(null);
    setPhotoPreview('');
  }

  return (
    <>
      {/* Status messages */}
      {actionError && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}
      {successMsg && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{successMsg}</p>
      )}

      {/* Inspection status header with reset button */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Inspection Status</p>
          <p className={`mt-0.5 text-sm font-semibold ${
            inspection.status === 'pass'
              ? 'text-green-600'
              : inspection.status === 'fail'
                ? 'text-red-600'
                : 'text-gray-600'
          }`}>
            {inspection.status.charAt(0).toUpperCase() + inspection.status.slice(1)}
          </p>
        </div>
        {isCompleted && canReset && (
          <button
            onClick={requestReset}
            disabled={resetting}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reset
          </button>
        )}
      </div>

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
        <h2 className="mb-3 text-base font-semibold text-gray-900">Notes</h2>
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
      <PhotoCapture
        photoFile={photoFile}
        photoPreview={photoPreview}
        existingPhotoUrl={inspection.photoUrl}
        onPhotoSelect={handlePhotoSelect}
        onPhotoRemove={handlePhotoRemove}
        disabled={isCompleted || !canInspect}
        isCompleted={isCompleted}
        canInspect={canInspect}
      />

      {/* GPS Capture */}
      <GpsCapture
        gps={gps}
        onGpsChange={setGps}
        disabled={isCompleted || !canInspect}
        isCompleted={isCompleted}
        canInspect={canInspect}
        onError={handleGpsError}
      />

      {/* Attestation notice */}
      {canInspect && isPending && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-700">
            By marking this inspection as Pass or Fail, you certify that this inspection was
            performed according to NFPA 10 standards.
          </p>
        </div>
      )}

      {/* Pass / Fail buttons */}
      {canInspect && isPending && (
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={handlePassClick}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-4 text-base font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
            Pass
          </button>
          <button
            onClick={handleFailClick}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-4 text-base font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <XCircle className="h-6 w-6" />
            )}
            Fail
          </button>
        </div>
      )}

      {/* Completed info */}
      {isCompleted && inspection.inspectedByEmail && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            Inspected by{' '}
            <span className="font-medium">{inspection.inspectedByEmail}</span>
            {!!inspection.inspectedAt && (
              <> on {formatTimestamp(inspection.inspectedAt)}</>
            )}
          </p>
        </div>
      )}

      {/* Quick fail modal */}
      <QuickFailModal
        open={quickFailOpen}
        onClose={() => setQuickFailOpen(false)}
        onSubmit={handleQuickFailSubmit}
        saving={saving}
      />

      {/* Reset confirmation modal */}
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
    </>
  );
}

/** Format a Firestore timestamp or date string for display. */
function formatTimestamp(ts: unknown): string {
  if (!ts) return '--';
  try {
    const maybeTs = ts as { toDate?: () => Date; seconds?: number };
    const date = typeof maybeTs.toDate === 'function'
      ? maybeTs.toDate()
      : maybeTs.seconds
        ? new Date(maybeTs.seconds * 1000)
        : new Date(ts as string);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '--';
  }
}
