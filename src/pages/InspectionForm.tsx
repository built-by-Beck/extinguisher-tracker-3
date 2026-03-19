import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useOffline } from '../hooks/useOffline.ts';
import {
  getInspection,
  saveInspectionOfflineAware,
  resetInspectionCall,
  CHECKLIST_ITEMS,
  EMPTY_CHECKLIST,
  type Inspection,
  type ChecklistData,
} from '../services/inspectionService.ts';
import { getCachedInspectionsForWorkspace } from '../services/offlineCacheService.ts';
import { WifiOff } from 'lucide-react';

type CheckValue = 'pass' | 'fail' | 'n/a';

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
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistData>({ ...EMPTY_CHECKLIST });
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!orgId || !inspectionId) return;

    getInspection(orgId, inspectionId)
      .then((insp) => {
        setInspection(insp);
        if (insp?.checklistData) {
          setChecklist(insp.checklistData);
        }
        if (insp?.notes) {
          setNotes(insp.notes);
        }
        setLoading(false);
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
            }
          } catch {
            // Cache read failed — leave inspection as null
          }
        }
        setLoading(false);
      });
  }, [orgId, inspectionId, workspaceId, isOnline]);

  function updateChecklist(key: keyof ChecklistData, value: CheckValue) {
    setChecklist((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(status: 'pass' | 'fail') {
    if (!orgId || !inspectionId || !inspection) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const result = await saveInspectionOfflineAware(
        orgId,
        inspectionId,
        inspection.extinguisherId,
        inspection.workspaceId,
        {
          status,
          checklistData: checklist,
          notes,
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
      } else {
        setSuccessMsg(
          'Inspection saved locally. It will sync when you\'re back online.',
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save inspection.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!orgId || !inspectionId) return;
    if (!confirm('Reset this inspection to pending? This action is logged.')) return;

    setResetting(true);
    setError('');

    try {
      await resetInspectionCall(orgId, inspectionId);
      setChecklist({ ...EMPTY_CHECKLIST });
      setNotes('');
      setSuccessMsg('Inspection reset to pending.');
      const updated = await getInspection(orgId, inspectionId);
      setInspection(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset inspection.');
    } finally {
      setResetting(false);
    }
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
              onClick={handleReset}
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
          You are offline. Viewing cached data.
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {successMsg && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{successMsg}</p>
      )}

      {/* NFPA 13-Point Checklist */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold text-gray-900">NFPA 10 Inspection Checklist</h2>
        </div>

        <div>
          {CHECKLIST_ITEMS.map((item) => (
            <ChecklistRow
              key={item.key}
              label={item.label}
              value={checklist[item.key] as CheckValue}
              onChange={(v) => updateChecklist(item.key, v)}
              disabled={isCompleted || !canInspect}
            />
          ))}
        </div>
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
    </div>
  );
}
