import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Save,
  XCircle,
} from 'lucide-react';
import { storage } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useOffline } from '../hooks/useOffline.ts';
import { canUseCustomAssetInspections } from '../lib/planConfig.ts';
import { GpsCapture, type GpsData } from '../components/inspection/GpsCapture.tsx';
import { PhotoCapture } from '../components/inspection/PhotoCapture.tsx';
import {
  ensureCustomAssetInspectionForWorkspace,
  getAsset,
  type ChecklistAnswer,
  type CustomAsset,
  type CustomAssetInspectionItem,
  type CustomAssetInspectionResult,
} from '../services/assetService.ts';
import {
  getActiveWorkspaceForCurrentMonth,
  type Workspace,
} from '../services/workspaceService.ts';
import {
  getInspection,
  getInspectionForAssetInWorkspace,
  getInspectionHistoryForAsset,
  saveInspectionCall,
  type Inspection,
} from '../services/inspectionService.ts';

function isWritableSubscription(plan?: string | null, status?: string | null): boolean {
  return plan === 'enterprise' || status === 'active' || status === 'trialing';
}

function emptyAnswers(items: CustomAssetInspectionItem[]): Record<string, ChecklistAnswer> {
  return Object.fromEntries(items.map((item) => [item.id, { result: 'unchecked' as const }]));
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CustomAssetDetail() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const { isOnline } = useOffline();
  const orgId = userProfile?.activeOrgId ?? '';
  const canUseFeature =
    canUseCustomAssetInspections(org?.featureFlags, org?.plan) &&
    isWritableSubscription(org?.plan, org?.subscriptionStatus);
  const canInspect = canUseFeature && hasRole(['owner', 'admin', 'inspector']);

  const [asset, setAsset] = useState<CustomAsset | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [history, setHistory] = useState<Inspection[]>([]);
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer>>({});
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState('');
  const [gps, setGps] = useState<GpsData | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!orgId || !assetId) return;
    setLoading(true);
    setError('');
    try {
      const loadedAsset = await getAsset(orgId, assetId);
      setAsset(loadedAsset);
      if (!loadedAsset) {
        setInspection(null);
        return;
      }

      const activeWorkspace = await getActiveWorkspaceForCurrentMonth(orgId);
      setWorkspace(activeWorkspace);
      if (!activeWorkspace || !loadedAsset.active || loadedAsset.status !== 'active') {
        setInspection(null);
        setHistory(await getInspectionHistoryForAsset(orgId, assetId));
        return;
      }

      let activeInspection = await getInspectionForAssetInWorkspace(orgId, assetId, activeWorkspace.id);
      if (!activeInspection && canInspect && loadedAsset.recurrence === 'monthly') {
        const inspectionId = await ensureCustomAssetInspectionForWorkspace(orgId, activeWorkspace.id, assetId);
        activeInspection = await getInspection(orgId, inspectionId);
      }
      setInspection(activeInspection);
      const snapshot = activeInspection?.checklistSnapshot?.length
        ? activeInspection.checklistSnapshot
        : loadedAsset.inspectionItems.filter((item) => item.active);
      setAnswers(activeInspection?.checklistAnswers ?? emptyAnswers(snapshot));
      setNotes(activeInspection?.notes ?? '');
      setDetails(activeInspection?.details ?? '');
      setGps((activeInspection?.gps as GpsData | null) ?? null);
      setHistory(await getInspectionHistoryForAsset(orgId, assetId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load custom asset.');
    } finally {
      setLoading(false);
    }
  }, [assetId, canInspect, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inspectionColumns = useMemo(() => {
    const source = inspection?.checklistSnapshot?.length
      ? inspection.checklistSnapshot
      : asset?.inspectionItems.filter((item) => item.active) ?? [];
    return [...source].sort((a, b) => a.order - b.order);
  }, [asset, inspection]);

  const isCompleted = inspection?.status === 'pass' || inspection?.status === 'fail';

  function setAnswer(itemId: string, result: CustomAssetInspectionResult) {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        result,
        answeredAt: new Date().toISOString(),
        answeredBy: user?.uid,
      },
    }));
  }

  function setAnswerNotes(itemId: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        result: prev[itemId]?.result ?? 'unchecked',
        notes: value,
      },
    }));
  }

  async function saveInspection() {
    if (!orgId || !inspection?.id || !canInspect) return;
    const hasUnchecked = inspectionColumns.some((item) => (answers[item.id]?.result ?? 'unchecked') === 'unchecked');
    if (hasUnchecked) {
      setError('Answer each inspection column before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      let photoUrl: string | null = null;
      let photoPath: string | null = null;
      if (photoFile && isOnline) {
        const path = `org/${orgId}/custom-asset-inspections/${inspection.id}/photo_${Date.now()}.jpg`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, photoFile);
        photoUrl = await getDownloadURL(fileRef);
        photoPath = path;
      }

      const overallStatus = Object.values(answers).some((answer) => answer.result === 'fail') ? 'fail' : 'pass';
      await saveInspectionCall(orgId, inspection.id, {
        status: overallStatus,
        checklistAnswers: answers,
        notes,
        details,
        photoUrl,
        photoPath,
        gps: gps ?? null,
        attestation: {
          confirmed: true,
          text: 'I certify this custom asset inspection was completed according to this organization\'s inspection procedure.',
          inspectorName: user?.displayName ?? user?.email ?? 'Unknown',
        },
      });
      setSuccess('Custom asset inspection saved.');
      setPhotoFile(null);
      setPhotoPreview('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save custom asset inspection.');
    } finally {
      setSaving(false);
    }
  }

  if (!canUseFeature) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
          <h1 className="text-xl font-bold text-gray-900">Custom Asset Inspections</h1>
          <p className="mt-2 text-sm text-gray-600">This Pro feature is locked for your current organization.</p>
          <Link to="/dashboard/custom-asset-inspections" className="mt-4 inline-block text-sm font-medium text-indigo-700">
            Back to feature overview
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        Loading custom asset...
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600">Custom asset not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button onClick={() => navigate('/dashboard/custom-asset-inspections')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back to Custom Asset Inspections
      </button>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {asset.assetType && <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">{asset.assetType}</span>}
              {asset.assetCode && <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{asset.assetCode}</span>}
              <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{statusLabel(asset.status)}</span>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <p className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-gray-400" />
              {asset.locationName || 'Unassigned'}
            </p>
            <p className="mt-1">Recurrence: {asset.recurrence}</p>
          </div>
        </div>
        {(asset.notes || asset.details || asset.barcode || asset.serialNumber) && (
          <div className="mt-4 grid gap-3 text-sm text-gray-600 md:grid-cols-2">
            {asset.barcode && <p><span className="font-medium text-gray-800">Barcode:</span> {asset.barcode}</p>}
            {asset.serialNumber && <p><span className="font-medium text-gray-800">Serial:</span> {asset.serialNumber}</p>}
            {asset.notes && <p><span className="font-medium text-gray-800">Notes:</span> {asset.notes}</p>}
            {asset.details && <p><span className="font-medium text-gray-800">Details:</span> {asset.details}</p>}
          </div>
        )}
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current Workspace Inspection</h2>
            <p className="text-sm text-gray-500">
              {workspace ? `${workspace.label} · ${statusLabel(inspection?.status ?? 'pending')}` : 'No active workspace for this month.'}
            </p>
          </div>
          {inspection?.status === 'pass' ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : inspection?.status === 'fail' ? (
            <XCircle className="h-6 w-6 text-red-600" />
          ) : (
            <Clock className="h-6 w-6 text-amber-500" />
          )}
        </div>

        {!workspace ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            Create this month&apos;s workspace from the Inspections page before completing custom asset inspections.
          </p>
        ) : !inspection ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            This asset is not available for the current workspace. Only active monthly custom assets are seeded for v1.
          </p>
        ) : (
          <>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Inspection column</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Result</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Cell notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inspectionColumns.map((item) => {
                      const answer = answers[item.id] ?? { result: 'unchecked' };
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-3 font-medium text-gray-900">{item.label}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(['pass', 'fail', 'na'] as CustomAssetInspectionResult[]).map((result) => (
                                <button
                                  key={result}
                                  type="button"
                                  onClick={() => setAnswer(item.id, result)}
                                  disabled={!canInspect || isCompleted}
                                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                                    answer.result === result
                                      ? result === 'pass'
                                        ? 'bg-green-600 text-white'
                                        : result === 'fail'
                                          ? 'bg-red-600 text-white'
                                          : 'bg-gray-700 text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  } disabled:cursor-not-allowed disabled:opacity-50`}
                                >
                                  {result === 'na' ? 'N/A' : result.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={answer.notes ?? ''}
                              onChange={(event) => setAnswerNotes(item.id, event.target.value)}
                              disabled={!canInspect || isCompleted}
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                              placeholder="Optional note"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <aside className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="rounded-lg border border-indigo-100 bg-white p-3">
                  <p className="text-sm font-semibold text-gray-900">Saved setup</p>
                  <p className="mt-1 text-xs text-gray-500">
                    This asset row and its inspection columns are saved on the custom asset. Next month&apos;s workspace will reuse them automatically.
                  </p>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Inspection notes</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={!canInspect || isCompleted}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                    placeholder="Notes from this inspection..."
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Inspection details</span>
                  <textarea
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    disabled={!canInspect || isCompleted}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                    placeholder="Test readings, recall notes, phone test info, or other details..."
                  />
                </label>

                {(asset.notes || asset.details) && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
                    <p className="mb-2 font-semibold uppercase tracking-wide text-gray-500">Asset reference</p>
                    {asset.notes && <p><span className="font-medium text-gray-800">Asset notes:</span> {asset.notes}</p>}
                    {asset.details && <p className="mt-2"><span className="font-medium text-gray-800">Asset details:</span> {asset.details}</p>}
                  </div>
                )}
              </aside>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <GpsCapture
                gps={gps}
                onGpsChange={setGps}
                disabled={!canInspect || isCompleted}
                isCompleted={isCompleted}
                canInspect={canInspect}
                onError={setError}
              />
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-gray-900">Inspection Photos</h2>
                <PhotoCapture
                  photoFile={photoFile}
                  photoPreview={photoPreview}
                  existingPhotoUrl={inspection.photoUrl}
                  onPhotoSelect={(file, preview) => {
                    setPhotoFile(file);
                    setPhotoPreview(preview);
                  }}
                  onPhotoRemove={() => {
                    setPhotoFile(null);
                    setPhotoPreview('');
                  }}
                  disabled={!canInspect || isCompleted}
                  isCompleted={isCompleted}
                  canInspect={canInspect}
                />
              </div>
            </div>

            {canInspect && !isCompleted && (
              <div className="mt-5 flex justify-end">
                <button
                  onClick={saveInspection}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Inspection
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Inspection History</h2>
        <p className="mt-1 text-sm text-gray-500">History uses the original inspection-column snapshot for each inspection.</p>
        <div className="mt-4 divide-y divide-gray-100">
          {history.filter((item) => item.status === 'pass' || item.status === 'fail').length === 0 ? (
            <p className="py-6 text-sm text-gray-500">No completed custom asset inspections yet.</p>
          ) : (
            history
              .filter((item) => item.status === 'pass' || item.status === 'fail')
              .map((item) => (
                <div key={item.id} className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.workspaceId}</p>
                      <p className="text-xs text-gray-500">{item.inspectedByEmail ?? 'Unknown inspector'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  {(item.notes || item.details) && (
                    <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                      {item.notes && (
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                          <p className="font-semibold text-gray-700">Inspection notes</p>
                          <p className="mt-1 whitespace-pre-wrap text-gray-600">{item.notes}</p>
                        </div>
                      )}
                      {item.details && (
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                          <p className="font-semibold text-gray-700">Inspection details</p>
                          <p className="mt-1 whitespace-pre-wrap text-gray-600">{item.details}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {(item.checklistSnapshot ?? []).map((snapshotItem) => {
                      const answer = item.checklistAnswers?.[snapshotItem.id];
                      return (
                        <div key={snapshotItem.id} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                          <span className="font-medium text-gray-800">{snapshotItem.label}</span>
                          <span className="ml-2 text-gray-500">{(answer?.result ?? 'unchecked').toUpperCase()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
