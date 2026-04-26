import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Edit2,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { canUseCustomAssetInspections } from '../lib/planConfig.ts';
import { LocationSelector } from '../components/locations/LocationSelector.tsx';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import {
  createAsset,
  createInspectionItem,
  getLocationName,
  listenToAssets,
  retireAsset,
  updateAsset,
  type CreateAssetInput,
  type CustomAsset,
  type CustomAssetInspectionItem,
  type CustomAssetRecurrence,
} from '../services/assetService.ts';
import { subscribeToLocations, type Location } from '../services/locationService.ts';

const RECURRENCE_OPTIONS: CustomAssetRecurrence[] = ['monthly', 'weekly', 'quarterly', 'annual', 'custom'];

function isWritableSubscription(plan?: string | null, status?: string | null): boolean {
  return plan === 'enterprise' || status === 'active' || status === 'trialing';
}

function emptyFormItems(): CustomAssetInspectionItem[] {
  return [createInspectionItem('', 0)];
}

export default function CustomAssetInspections() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';
  const canManage = hasRole(['owner', 'admin']);
  const canUseFeature =
    canUseCustomAssetInspections(org?.featureFlags, org?.plan) &&
    isWritableSubscription(org?.plan, org?.subscriptionStatus);

  const [assets, setAssets] = useState<CustomAsset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CustomAsset | null>(null);
  const [retireTarget, setRetireTarget] = useState<CustomAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<CustomAssetRecurrence>('monthly');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState('');
  const [inspectionItems, setInspectionItems] = useState<CustomAssetInspectionItem[]>(emptyFormItems);

  useEffect(() => {
    if (!orgId || !canUseFeature) return;
    return listenToAssets(orgId, setAssets);
  }, [orgId, canUseFeature]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) =>
      [
        asset.name,
        asset.assetType,
        asset.assetCode,
        asset.barcode,
        asset.serialNumber,
        asset.locationName,
      ].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [assets, search]);

  function resetForm() {
    setEditingAsset(null);
    setName('');
    setAssetType('');
    setAssetCode('');
    setBarcode('');
    setSerialNumber('');
    setLocationId(null);
    setRecurrence('monthly');
    setNotes('');
    setDetails('');
    setInspectionItems(emptyFormItems());
    setError('');
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(asset: CustomAsset) {
    setEditingAsset(asset);
    setName(asset.name);
    setAssetType(asset.assetType ?? '');
    setAssetCode(asset.assetCode ?? '');
    setBarcode(asset.barcode ?? '');
    setSerialNumber(asset.serialNumber ?? '');
    setLocationId(asset.locationId || null);
    setRecurrence(asset.recurrence ?? 'monthly');
    setNotes(asset.notes ?? '');
    setDetails(asset.details ?? '');
    setInspectionItems(asset.inspectionItems.length ? [...asset.inspectionItems].sort((a, b) => a.order - b.order) : emptyFormItems());
    setError('');
    setShowForm(true);
  }

  function updateItem(index: number, label: string) {
    setInspectionItems((items) => items.map((item, i) => (i === index ? { ...item, label } : item)));
  }

  function removeItem(index: number) {
    setInspectionItems((items) =>
      items.length === 1
        ? emptyFormItems()
        : items.filter((_, i) => i !== index).map((item, order) => ({ ...item, order })),
    );
  }

  function moveItem(index: number, delta: -1 | 1) {
    setInspectionItems((items) => {
      const next = [...items];
      const target = index + delta;
      if (target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, order) => ({ ...item, order }));
    });
  }

  async function handleSave() {
    if (!orgId || !user || !canManage) return;
    const cleanItems = inspectionItems.filter((item) => item.label.trim());
    if (!name.trim()) {
      setError('Asset name is required.');
      return;
    }
    if (cleanItems.length === 0) {
      setError(`Add at least one thing you will inspect on ${name.trim()}.`);
      return;
    }

    setSaving(true);
    setError('');
    const input: CreateAssetInput = {
      name,
      assetType,
      assetCode,
      barcode,
      serialNumber,
      locationId,
      locationName: getLocationName(locations, locationId),
      recurrence,
      notes,
      details,
      inspectionItems: cleanItems,
    };

    try {
      if (editingAsset?.id) {
        await updateAsset(orgId, editingAsset.id, user.uid, input);
      } else {
        await createAsset(orgId, user.uid, input);
      }
      setShowForm(false);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save custom asset.');
    } finally {
      setSaving(false);
    }
  }

  async function executeRetire() {
    if (!orgId || !user || !retireTarget?.id) return;
    try {
      await retireAsset(orgId, retireTarget.id, user.uid);
      setRetireTarget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retire custom asset.');
      setRetireTarget(null);
    }
  }

  if (!canUseFeature) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Lock className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Pro feature</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Custom Asset Inspections</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Track inspections for non-extinguisher assets with your own rows and inspection columns. Basic
            organizations can preview this feature, but creating assets and completing custom inspections requires Pro or higher.
          </p>
          <div className="mt-6 rounded-xl border border-indigo-100 bg-white p-5">
            <p className="font-medium text-gray-900">What this unlocks</p>
            <div className="mt-3 grid gap-3 text-sm text-gray-600 md:grid-cols-3">
              <div>Custom asset rows tied to your locations</div>
              <div>Editable inspection columns per asset</div>
              <div>Monthly history with original column snapshots</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Asset Inspections</h1>
          <p className="mt-1 text-sm text-gray-500">
            Build your own inspection grid: asset rows, custom inspection columns, monthly results.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Custom Asset
          </button>
        )}
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search custom assets, locations, codes, or types..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>What asset are you inspecting?</span>
          <span>Location</span>
          <span>Type / Code</span>
          <span>Inspection columns</span>
          <span />
        </div>
        {filteredAssets.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">No custom assets yet</p>
            <p className="mt-1 text-sm text-gray-500">Add your first row, then define what you inspect on it.</p>
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="grid cursor-pointer grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm hover:bg-gray-50 last:border-b-0"
              onClick={() => navigate(`/dashboard/custom-asset-inspections/${asset.id}`)}
            >
              <div>
                <p className="font-semibold text-gray-900">{asset.name}</p>
                <p className="text-xs text-gray-500">{asset.status.replace(/_/g, ' ')}</p>
              </div>
              <span className="text-gray-600">{asset.locationName || 'Unassigned'}</span>
              <span className="text-gray-600">{asset.assetType || asset.assetCode || 'Custom asset'}</span>
              <span className="text-gray-600">
                {asset.inspectionItems.filter((item) => item.active).length} column
                {asset.inspectionItems.filter((item) => item.active).length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-1">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(asset);
                      }}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      aria-label="Edit custom asset"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {asset.active && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRetireTarget(asset);
                        }}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Retire custom asset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingAsset ? 'Edit Custom Asset' : 'Add Custom Asset'}
                </h2>
                <p className="text-sm text-gray-500">What asset are you inspecting?</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Close custom asset form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 px-6 py-5">
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Asset name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Building D elevator" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Asset type (optional)</span>
                  <input value={assetType} onChange={(e) => setAssetType(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="User-defined type" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Asset code (optional)</span>
                  <input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Recurrence</span>
                  <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as CustomAssetRecurrence)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    {RECURRENCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Barcode (optional)</span>
                  <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Serial number (optional)</span>
                  <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Where is this asset?</span>
                <div className="mt-1">
                  <LocationSelector value={locationId} onChange={setLocationId} />
                </div>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Notes</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Details</span>
                  <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </label>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      What on {name.trim() || 'this asset'} are you inspecting?
                    </p>
                    <p className="text-xs text-gray-500">
                      Each answer becomes an editable inspection column for this asset row and is saved for future monthly workspaces.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectionItems((items) => [...items, createInspectionItem('', items.length)])}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50"
                  >
                    Add column
                  </button>
                </div>
                <div className="space-y-2">
                  {inspectionItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => updateItem(index, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Inspection column name"
                      />
                      <button type="button" onClick={() => moveItem(index, -1)} className="rounded p-2 text-gray-400 hover:bg-white hover:text-gray-700" aria-label="Move inspection column up"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => moveItem(index, 1)} className="rounded p-2 text-gray-400 hover:bg-white hover:text-gray-700" aria-label="Move inspection column down"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => removeItem(index)} className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove inspection column"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Custom Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!retireTarget}
        title="Retire Custom Asset"
        message={`Retire ${retireTarget?.name ?? 'this asset'}? It will no longer be seeded into active monthly inspections.`}
        confirmLabel="Retire"
        variant="warning"
        onConfirm={executeRetire}
        onCancel={() => setRetireTarget(null)}
      />
    </div>
  );
}
