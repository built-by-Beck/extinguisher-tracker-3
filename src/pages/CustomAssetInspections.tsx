import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit2,
  Info,
  Layers,
  Lock,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { canUseCustomAssetInspections } from '../lib/planConfig.ts';
import {
  DetailedLocationPicker,
  type DetailedLocationValue,
} from '../components/locations/DetailedLocationPicker.tsx';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import {
  createAsset,
  createAssetInspectionTemplate,
  createInspectionItem,
  copyInspectionItemsForAsset,
  listenToAssets,
  listenToAssetInspectionTemplates,
  retireAsset,
  updateAsset,
  ensureCustomAssetInspectionForWorkspace,
  type ChecklistAnswer,
  type CreateAssetInput,
  type CustomAsset,
  type CustomAssetInspectionItem,
  type CustomAssetInspectionTemplate,
  type CustomAssetInspectionResult,
  type CustomAssetRecurrence,
} from '../services/assetService.ts';
import {
  getLocationPath,
  subscribeToLocations,
  type Location,
} from '../services/locationService.ts';
import {
  getActiveWorkspaceForCurrentMonth,
  type Workspace,
} from '../services/workspaceService.ts';
import {
  getInspection,
  getInspectionForAssetInWorkspace,
  saveInspectionCall,
  type Inspection,
} from '../services/inspectionService.ts';
import {
  ASSET_STARTERS,
  getStarterById,
  starterToInspectionItems,
} from '../lib/customAssetStarters.ts';
import {
  parseCsvText,
  resolveLocationIds,
  csvRowToCreateInput,
} from '../lib/customAssetCsv.ts';
import {
  generateAssetsFromLocations,
  getBuildingsWithStairwells,
} from '../lib/generateAssetsFromLocations.ts';
import { collectDistinctAssetTypes } from '../lib/customAssetTypes.ts';

const RECURRENCE_OPTIONS: CustomAssetRecurrence[] = [
  'monthly',
  'weekly',
  'quarterly',
  'annual',
  'custom',
];

function isWritableSubscription(
  plan?: string | null,
  status?: string | null,
): boolean {
  return plan === 'enterprise' || status === 'active' || status === 'trialing';
}

function emptyFormItems(): CustomAssetInspectionItem[] {
  return [createInspectionItem('', 0)];
}

/** Loosely match an inspection item label for Elevator-specific columns */
function matchesFireRecall(label: string): boolean {
  const l = label.toLowerCase();
  return l.includes('fire recall') || l.includes('recall');
}

function matchesCommsPhone(label: string): boolean {
  const l = label.toLowerCase();
  return (
    (l.includes('communication') || l.includes('phone')) &&
    !l.includes('fire recall')
  );
}

function resultBadge(result: CustomAssetInspectionResult | undefined) {
  if (!result || result === 'unchecked')
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        Pending
      </span>
    );
  if (result === 'pass')
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
        Pass
      </span>
    );
  if (result === 'fail')
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        Fail
      </span>
    );
  return (
    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
      N/A
    </span>
  );
}

export default function CustomAssetInspections() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';
  const canManage = hasRole(['owner', 'admin']);
  const canInspect = hasRole(['owner', 'admin', 'inspector']);
  const canUseFeature =
    canUseCustomAssetInspections(org?.featureFlags, org?.plan) &&
    isWritableSubscription(org?.plan, org?.subscriptionStatus);

  // ─── data ─────────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<CustomAsset[]>([]);
  const [templates, setTemplates] = useState<CustomAssetInspectionTemplate[]>(
    [],
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(
    null,
  );
  const [inspectionsByAsset, setInspectionsByAsset] = useState<
    Record<string, Inspection | null>
  >({});
  const [answersByAsset, setAnswersByAsset] = useState<
    Record<string, Record<string, ChecklistAnswer>>
  >({});
  const [savingInspectionAssetId, setSavingInspectionAssetId] = useState<
    string | null
  >(null);

  // ─── tab state ────────────────────────────────────────────────────────────
  // 'setup' = Setup/All tab; any other value = assetType
  const activeTab = searchParams.get('type') ?? 'setup';

  function setTab(value: string) {
    if (value === 'setup') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ type: value }, { replace: true });
    }
  }

  // ─── search / ui state ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CustomAsset | null>(null);
  const [retireTarget, setRetireTarget] = useState<CustomAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [error, setError] = useState('');
  const [templateMessage, setTemplateMessage] = useState('');

  // ─── form fields ──────────────────────────────────────────────────────────
  const [selectedStarterId, setSelectedStarterId] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [assetFloor, setAssetFloor] = useState('');
  const [assetVicinity, setAssetVicinity] = useState('');
  const [locationName, setLocationName] = useState('');
  const [recurrence, setRecurrence] =
    useState<CustomAssetRecurrence>('monthly');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState('');
  const [inspectionItems, setInspectionItems] =
    useState<CustomAssetInspectionItem[]>(emptyFormItems);

  // Paste-one-per-line textarea
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // ─── CSV import state ─────────────────────────────────────────────────────
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvPreviewCount, setCsvPreviewCount] = useState(0);
  const [csvImporting, setCsvImporting] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  // ─── generate-from-locations state ───────────────────────────────────────
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genStarterId, setGenStarterId] = useState(ASSET_STARTERS[0].id);
  const [genRootId, setGenRootId] = useState<string>('');
  const [genPreview, setGenPreview] = useState<CreateAssetInput[]>([]);
  const [genSkipped, setGenSkipped] = useState<string[]>([]);
  const [genRunning, setGenRunning] = useState(false);
  const [genError, setGenError] = useState('');

  // ─── subscriptions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId || !canUseFeature) return;
    return listenToAssets(orgId, setAssets);
  }, [orgId, canUseFeature]);

  useEffect(() => {
    if (!orgId || !canUseFeature) return;
    return listenToAssetInspectionTemplates(orgId, setTemplates);
  }, [orgId, canUseFeature]);

  useEffect(() => {
    if (!orgId || !canUseFeature) {
      setActiveWorkspace(null);
      return;
    }
    getActiveWorkspaceForCurrentMonth(orgId)
      .then(setActiveWorkspace)
      .catch(() => setActiveWorkspace(null));
  }, [orgId, canUseFeature]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !canUseFeature || !activeWorkspace || assets.length === 0)
      return;
    let cancelled = false;
    const workspaceId = activeWorkspace.id;

    async function loadAssetInspections() {
      const nextInspections: Record<string, Inspection | null> = {};
      const nextAnswers: Record<string, Record<string, ChecklistAnswer>> = {};

      for (const asset of assets) {
        if (
          !asset.id ||
          !asset.active ||
          asset.status !== 'active' ||
          asset.recurrence !== 'monthly'
        )
          continue;
        let inspection = await getInspectionForAssetInWorkspace(
          orgId,
          asset.id,
          workspaceId,
        );
        if (!inspection && canManage) {
          const inspectionId = await ensureCustomAssetInspectionForWorkspace(
            orgId,
            workspaceId,
            asset.id,
          );
          inspection = await getInspection(orgId, inspectionId);
        }
        nextInspections[asset.id] = inspection;
        const items = inspection?.checklistSnapshot?.length
          ? inspection.checklistSnapshot
          : asset.inspectionItems.filter((item) => item.active);
        nextAnswers[asset.id] =
          inspection?.checklistAnswers ??
          Object.fromEntries(
            items.map((item) => [item.id, { result: 'unchecked' as const }]),
          );
      }

      if (!cancelled) {
        setInspectionsByAsset(nextInspections);
        setAnswersByAsset(nextAnswers);
      }
    }

    loadAssetInspections().catch((err: unknown) => {
      if (!cancelled)
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load custom asset inspections.',
        );
    });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspace, assets, canManage, canUseFeature, orgId]);

  // ─── derived data ─────────────────────────────────────────────────────────
  const activeAssets = useMemo(
    () => assets.filter((a) => a.active && a.status === 'active'),
    [assets],
  );

  const distinctTypes = useMemo(
    () => collectDistinctAssetTypes(activeAssets),
    [activeAssets],
  );

  const filteredAssets = useMemo(() => {
    const base =
      activeTab === 'setup'
        ? assets
        : activeAssets.filter((a) => a.assetType?.trim() === activeTab);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((asset) =>
      [
        asset.name,
        asset.assetType,
        asset.assetCode,
        asset.barcode,
        asset.serialNumber,
        asset.locationName,
      ].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [assets, activeAssets, activeTab, search]);

  const matchingTemplates = useMemo(() => {
    const normalized = assetType.trim().toLowerCase();
    if (!normalized) return [];
    return templates.filter(
      (template) => template.assetType?.trim().toLowerCase() === normalized,
    );
  }, [assetType, templates]);

  const buildingsWithStairwells = useMemo(
    () => getBuildingsWithStairwells(locations),
    [locations],
  );

  // ─── form helpers ─────────────────────────────────────────────────────────
  function resetForm() {
    setEditingAsset(null);
    setSelectedStarterId('');
    setName('');
    setAssetType('');
    setTemplateName('');
    setSelectedTemplateId('');
    setAssetCode('');
    setBarcode('');
    setSerialNumber('');
    setLocationId(null);
    setAssetFloor('');
    setAssetVicinity('');
    setLocationName('');
    setRecurrence('monthly');
    setNotes('');
    setDetails('');
    setInspectionItems(emptyFormItems());
    setPasteMode(false);
    setPasteText('');
    setError('');
    setTemplateMessage('');
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(asset: CustomAsset) {
    setEditingAsset(asset);
    setSelectedStarterId('');
    setName(asset.name);
    setAssetType(asset.assetType ?? '');
    setTemplateName('');
    setSelectedTemplateId(asset.templateId ?? '');
    setAssetCode(asset.assetCode ?? '');
    setBarcode(asset.barcode ?? '');
    setSerialNumber(asset.serialNumber ?? '');
    setLocationId(asset.locationId || null);
    setAssetFloor(asset.floor ?? '');
    setAssetVicinity(asset.vicinity ?? '');
    setLocationName(asset.locationName ?? '');
    setRecurrence(asset.recurrence ?? 'monthly');
    setNotes(asset.notes ?? '');
    setDetails(asset.details ?? '');
    setInspectionItems(
      asset.inspectionItems.length
        ? [...asset.inspectionItems].sort((a, b) => a.order - b.order)
        : emptyFormItems(),
    );
    setPasteMode(false);
    setPasteText('');
    setError('');
    setTemplateMessage('');
    setShowForm(true);
  }

  function applyStarter(starterId: string) {
    const starter = getStarterById(starterId);
    if (!starter) return;
    setSelectedStarterId(starterId);
    setAssetType(starter.assetType);
    const items = starterToInspectionItems(starter);
    setInspectionItems(items.length ? items : emptyFormItems());
    setTemplateMessage('');
  }

  function updateItem(index: number, label: string) {
    setInspectionItems((items) =>
      items.map((item, i) => (i === index ? { ...item, label } : item)),
    );
  }

  function removeItem(index: number) {
    setInspectionItems((items) =>
      items.length === 1
        ? emptyFormItems()
        : items
            .filter((_, i) => i !== index)
            .map((item, order) => ({ ...item, order })),
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

  function applyPasteColumns() {
    const labels = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (labels.length === 0) return;
    const existingLabels = inspectionItems
      .filter((i) => i.label.trim())
      .map((i) => i.label);
    const allLabels = [...existingLabels, ...labels];
    setInspectionItems(
      allLabels.map((label, order) => createInspectionItem(label, order)),
    );
    setPasteText('');
    setPasteMode(false);
  }

  function isStarterItemSelected(label: string): boolean {
    const normalized = label.trim().toLowerCase();
    return inspectionItems.some(
      (item) => item.label.trim().toLowerCase() === normalized,
    );
  }

  function toggleStarterChecklistItem(label: string) {
    const normalized = label.trim().toLowerCase();
    setInspectionItems((items) => {
      const hasItem = items.some(
        (item) => item.label.trim().toLowerCase() === normalized,
      );
      if (hasItem) {
        const next = items.filter(
          (item) => item.label.trim().toLowerCase() !== normalized,
        );
        return next.length > 0 ? next : emptyFormItems();
      }
      const clean = items.filter((item) => item.label.trim());
      return [...clean, createInspectionItem(label, clean.length)].map(
        (item, order) => ({ ...item, order }),
      );
    });
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template?.id) return;
    setSelectedTemplateId(template.id);
    setInspectionItems(copyInspectionItemsForAsset(template.inspectionItems));
    setTemplateName(template.name);
    setTemplateMessage(`Applied template: ${template.name}`);
  }

  async function handleSaveAsTemplate() {
    if (!orgId || !user || !canManage) return;
    const cleanItems = inspectionItems.filter((item) => item.label.trim());
    if (cleanItems.length === 0) {
      setError('Add at least one inspection column before saving a template.');
      return;
    }
    const resolvedTemplateName = (
      templateName ||
      assetType ||
      name ||
      'Custom inspection template'
    ).trim();
    setTemplateSaving(true);
    setError('');
    setTemplateMessage('');
    try {
      const templateId = await createAssetInspectionTemplate(orgId, user.uid, {
        name: resolvedTemplateName,
        assetType,
        inspectionItems: cleanItems,
      });
      setSelectedTemplateId(templateId);
      setTemplateName(resolvedTemplateName);
      setTemplateMessage(`Saved template: ${resolvedTemplateName}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save inspection template.',
      );
    } finally {
      setTemplateSaving(false);
    }
  }

  // ─── inline inspection helpers ────────────────────────────────────────────
  function setInlineAnswer(
    assetId: string,
    itemId: string,
    result: CustomAssetInspectionResult,
  ) {
    setAnswersByAsset((prev) => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] ?? {}),
        [itemId]: {
          ...(prev[assetId]?.[itemId] ?? { result: 'unchecked' }),
          result,
          answeredAt: new Date().toISOString(),
          answeredBy: user?.uid,
        },
      },
    }));
  }

  function setInlineAnswerNotes(
    assetId: string,
    itemId: string,
    notesValue: string,
  ) {
    setAnswersByAsset((prev) => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] ?? {}),
        [itemId]: {
          ...(prev[assetId]?.[itemId] ?? { result: 'unchecked' }),
          notes: notesValue,
        },
      },
    }));
  }

  async function saveInlineInspection(asset: CustomAsset) {
    if (!orgId || !asset.id || !canInspect) return;
    const inspection = inspectionsByAsset[asset.id];
    if (!inspection?.id) {
      setError(
        "Create this month's workspace or open the asset detail before saving this custom inspection.",
      );
      return;
    }
    const activeItems = (
      inspection.checklistSnapshot?.length
        ? inspection.checklistSnapshot
        : asset.inspectionItems
    )
      .filter((item) => item.active)
      .sort((a, b) => a.order - b.order);
    const answers = answersByAsset[asset.id] ?? {};
    const hasUnchecked = activeItems.some(
      (item) => (answers[item.id]?.result ?? 'unchecked') === 'unchecked',
    );
    if (hasUnchecked) {
      setError(
        `Answer each inspection column for ${asset.name} before saving.`,
      );
      return;
    }

    setSavingInspectionAssetId(asset.id);
    setError('');
    try {
      const status = Object.values(answers).some(
        (answer) => answer.result === 'fail',
      )
        ? 'fail'
        : 'pass';
      await saveInspectionCall(orgId, inspection.id, {
        status,
        checklistAnswers: answers,
        notes: inspection.notes ?? '',
        details: inspection.details ?? '',
      });
      setInspectionsByAsset((prev) => ({
        ...prev,
        [asset.id!]: {
          ...inspection,
          status,
          checklistAnswers: answers,
        },
      }));
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save custom asset inspection.',
      );
    } finally {
      setSavingInspectionAssetId(null);
    }
  }

  // ─── save asset ───────────────────────────────────────────────────────────
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
      locationName:
        locationName ||
        (locationId ? getLocationPath(locations, locationId) : ''),
      floor: assetFloor || null,
      vicinity: assetVicinity || null,
      recurrence,
      templateId: selectedTemplateId || null,
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
      setError(
        err instanceof Error ? err.message : 'Failed to save custom asset.',
      );
    } finally {
      setSaving(false);
    }
  }

  // ─── retire ───────────────────────────────────────────────────────────────
  async function executeRetire() {
    if (!orgId || !user || !retireTarget?.id) return;
    try {
      await retireAsset(orgId, retireTarget.id, user.uid);
      setRetireTarget(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to retire custom asset.',
      );
      setRetireTarget(null);
    }
  }

  // ─── CSV import ───────────────────────────────────────────────────────────
  function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      const parsed = parseCsvText(text);
      setCsvErrors(parsed.errors);
      setCsvPreviewCount(parsed.rows.length);
    };
    reader.readAsText(file);
  }

  async function handleCsvImport() {
    if (!orgId || !user || !canManage || csvImporting) return;
    const parsed = parseCsvText(csvText);
    if (parsed.errors.length > 0) {
      setCsvErrors(parsed.errors);
      return;
    }
    if (parsed.rows.length === 0) {
      setCsvErrors(['No valid rows to import.']);
      return;
    }
    const resolved = resolveLocationIds(parsed.rows, locations);
    setCsvImporting(true);
    setCsvErrors([]);
    const importErrors: string[] = [];
    let imported = 0;

    for (const row of resolved) {
      try {
        const input = csvRowToCreateInput(row);
        await createAsset(orgId, user.uid, input);
        imported++;
      } catch (err: unknown) {
        importErrors.push(
          `"${row.name}": ${err instanceof Error ? err.message : 'Failed'}`,
        );
      }
    }

    setCsvImporting(false);
    if (importErrors.length > 0) {
      setCsvErrors([
        `Imported ${imported} asset(s). ${importErrors.length} failed:`,
        ...importErrors,
      ]);
    } else {
      setShowCsvModal(false);
      setCsvText('');
      setCsvErrors([]);
      setCsvPreviewCount(0);
    }
  }

  // ─── generate from locations ──────────────────────────────────────────────
  function refreshGeneratePreview(starterId: string, rootId: string) {
    const starter = getStarterById(starterId);
    if (!starter) return;
    const result = generateAssetsFromLocations({
      locations,
      rootLocationId: rootId || null,
      starter,
      existingAssets: activeAssets.map((a) => ({
        name: a.name,
        locationId: a.locationId,
      })),
    });
    setGenPreview(result.inputs);
    setGenSkipped(result.skippedDuplicates);
  }

  async function handleGenerateConfirm() {
    if (!orgId || !user || !canManage || genRunning) return;
    if (genPreview.length === 0) return;
    setGenRunning(true);
    setGenError('');
    const failed: string[] = [];
    let created = 0;

    for (const input of genPreview) {
      try {
        await createAsset(orgId, user.uid, input);
        created++;
      } catch (err: unknown) {
        failed.push(
          `"${input.name}": ${err instanceof Error ? err.message : 'Failed'}`,
        );
      }
    }

    setGenRunning(false);
    if (failed.length > 0) {
      setGenError(
        `Created ${created}. ${failed.length} failed:\n${failed.join('\n')}`,
      );
    } else {
      setShowGenerateModal(false);
      setGenPreview([]);
      setGenSkipped([]);
    }
  }

  // ─── locked state ─────────────────────────────────────────────────────────
  if (!canUseFeature) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Lock className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
            Pro feature
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Equipment & Asset Inspections
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Track and inspect any type of equipment or physical asset your
            organization manages. Set up each item once with a customizable
            checklist — every month you only mark Pass, Fail, or N/A. Requires
            Pro or higher.
          </p>
          <div className="mt-6 rounded-xl border border-indigo-100 bg-white p-5">
            <p className="font-medium text-gray-900">What this unlocks</p>
            <div className="mt-3 grid gap-3 text-sm text-gray-600 md:grid-cols-3">
              <div>Named assets with locations, IDs, and schedules</div>
              <div>Optional starter templates you can fully customize</div>
              <div>Monthly history with original checklist snapshots</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── main render ──────────────────────────────────────────────────────────
  const isElevatorTab = activeTab === 'Elevator';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-gray-900">
            Equipment & Asset Inspections
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Track and inspect any type of equipment or physical asset your
            organization manages. Each asset can have its own name, ID, barcode,
            serial number, location, inspection schedule, and fully customizable
            checklist.
          </p>
        </div>
        {canManage && activeTab === 'setup' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setShowGenerateModal(true);
                refreshGeneratePreview(genStarterId, genRootId);
              }}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Layers className="h-4 w-4" />
              Generate from Locations
            </button>
            <button
              onClick={() => setShowCsvModal(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add Asset
            </button>
          </div>
        )}
      </div>

      <div className="mb-5 space-y-3">
        <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div className="text-sm text-indigo-950">
            <p className="font-semibold">
              Starter templates are optional—not hardcoded limitations.
            </p>
            <p className="mt-1 leading-6 text-indigo-900/90">
              The equipment types shown below are examples designed to save
              time. Choose a starter template, customize every inspection item,
              or select Custom / Blank to create any type of asset your
              organization needs.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
          <p className="font-semibold text-gray-900">Use this page when</p>
          <p className="mt-1 leading-6">
            you need to track a specific physical item over time and maintain a
            recurring inspection history for that item.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
            <li>Elevator 20</li>
            <li>Emergency Light EL-104</li>
            <li>Exit Sign ES-117</li>
            <li>Fire Door WMC-214</li>
            <li>AED 008</li>
            <li>Generator 2</li>
            <li>Any other equipment created by the organization</li>
          </ul>
          <p className="mt-3 text-gray-600">
            Inspecting an area, route, building, or process instead of one
            specific physical asset?{' '}
            <Link
              to="/dashboard/field-work"
              className="font-medium text-indigo-700 hover:text-indigo-900"
            >
              Use Forms & Walkthroughs
            </Link>
            .
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('setup')}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'setup'
              ? 'border-b-2 border-indigo-600 text-indigo-700'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          Setup / All
        </button>
        {distinctTypes.map((type) => (
          <button
            key={type}
            onClick={() => setTab(type)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === type
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets, locations, codes, or types..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
      </div>

      {/* Elevator-specific column header */}
      {isElevatorTab ? (
        <ElevatorTab
          assets={filteredAssets}
          inspectionsByAsset={inspectionsByAsset}
          answersByAsset={answersByAsset}
          canManage={canManage}
          activeWorkspace={activeWorkspace}
          onNavigate={(id) =>
            navigate(`/dashboard/custom-asset-inspections/${id}`)
          }
          onEdit={openEdit}
          onRetire={setRetireTarget}
        />
      ) : (
        <AssetTable
          assets={filteredAssets}
          activeWorkspace={activeWorkspace}
          inspectionsByAsset={inspectionsByAsset}
          answersByAsset={answersByAsset}
          savingInspectionAssetId={savingInspectionAssetId}
          canManage={canManage}
          canInspect={canInspect}
          onNavigate={(id) =>
            navigate(`/dashboard/custom-asset-inspections/${id}`)
          }
          onEdit={openEdit}
          onRetire={setRetireTarget}
          onSetInlineAnswer={setInlineAnswer}
          onSetInlineAnswerNotes={setInlineAnswerNotes}
          onSaveInlineInspection={saveInlineInspection}
        />
      )}

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingAsset ? 'Edit Asset' : 'Add Asset'}
                </h2>
                <p className="text-sm text-gray-500">
                  {editingAsset
                    ? 'Update this asset.'
                    : 'Set up once — each month you only mark Pass, Fail, or N/A.'}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              {/* Persistence note */}
              {!editingAsset && (
                <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
                  <strong>Saved permanently.</strong> Once you add this asset,
                  each monthly workspace will include it automatically — you
                  only mark Pass, Fail, or N/A each month.
                </div>
              )}

              {/* Starter picker (create only) */}
              {!editingAsset && (
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    Optional starter template
                  </p>
                  <p className="mb-2 text-xs text-gray-500">
                    Templates only provide suggested starting fields. You can
                    change, add, reorder, or remove every inspection item.
                    Starter checklists are editable operational examples and
                    should be reviewed for your organization&apos;s
                    requirements.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ASSET_STARTERS.map((starter) => (
                      <button
                        key={starter.id}
                        type="button"
                        onClick={() => applyStarter(starter.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedStarterId === starter.id
                            ? starter.id === 'blank'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-indigo-600 bg-indigo-600 text-white'
                            : starter.id === 'blank'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400 hover:text-indigo-700'
                        }`}
                      >
                        {starter.label}
                      </button>
                    ))}
                  </div>
                  {selectedStarterId === 'blank' ? (
                    <p className="mt-2 text-xs text-emerald-800">
                      Custom / Blank lets you create any asset type with your
                      own inspection items — nothing is limited to the example
                      templates above.
                    </p>
                  ) : selectedStarterId ? (
                    <p className="mt-2 text-xs text-gray-500">
                      {getStarterById(selectedStarterId)?.description}
                    </p>
                  ) : null}
                  {selectedStarterId &&
                    selectedStarterId !== 'blank' &&
                    (getStarterById(selectedStarterId)?.defaultItems.length ??
                      0) > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-medium text-gray-700">
                          Suggested checklist items — tap to add or remove
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {getStarterById(selectedStarterId)!.defaultItems.map(
                            (itemLabel) => {
                              const selected = isStarterItemSelected(itemLabel);
                              return (
                                <button
                                  key={itemLabel}
                                  type="button"
                                  onClick={() =>
                                    toggleStarterChecklistItem(itemLabel)
                                  }
                                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                    selected
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-gray-300 bg-white text-gray-600 hover:border-indigo-400 hover:text-indigo-700'
                                  }`}
                                >
                                  {itemLabel}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* Core fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Asset name <span className="text-red-500">*</span>
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Enter an asset name, such as Emergency Light EL-104"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Asset type (optional)
                  </span>
                  <input
                    value={assetType}
                    onChange={(e) => {
                      setAssetType(e.target.value);
                      setTemplateMessage('');
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Enter an asset type, such as AED, Generator, Fire Door, or Custom Equipment"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Asset code (optional)
                  </span>
                  <input
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Recurrence
                  </span>
                  <select
                    value={recurrence}
                    onChange={(e) =>
                      setRecurrence(e.target.value as CustomAssetRecurrence)
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {RECURRENCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Barcode (optional)
                  </span>
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Serial number (optional)
                  </span>
                  <input
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
              </div>

              {/* Location */}
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Where is this asset?
                </span>
                <p className="mt-0.5 text-xs text-gray-500">
                  Building, floor, sub-location, and vicinity — remove any field
                  you do not need.
                </p>
                <div className="mt-1">
                  <DetailedLocationPicker
                    mode="assign"
                    locations={locations}
                    locationId={locationId}
                    vicinity={assetVicinity}
                    floorLabel={assetFloor}
                    onChange={(value: DetailedLocationValue) => {
                      setLocationId(value.locationId);
                      setAssetFloor(value.floor);
                      setAssetVicinity(value.vicinity);
                      setLocationName(value.locationPath);
                    }}
                  />
                </div>
              </div>

              {/* Notes / details */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Details
                  </span>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
              </div>

              {/* Template section */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-64 flex-1">
                    <span className="text-sm font-medium text-gray-700">
                      Apply org template
                    </span>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) =>
                        e.target.value
                          ? applyTemplate(e.target.value)
                          : setSelectedTemplateId('')
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">No template selected</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.assetType ? ` (${template.assetType})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-56 flex-1">
                    <span className="text-sm font-medium text-gray-700">
                      Template name
                    </span>
                    <input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder={
                        assetType ? `${assetType} template` : 'Template name'
                      }
                    />
                  </label>
                  {canManage && (
                    <button
                      type="button"
                      onClick={handleSaveAsTemplate}
                      disabled={templateSaving}
                      className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {templateSaving ? 'Saving...' : 'Save as template'}
                    </button>
                  )}
                </div>
                {matchingTemplates.length > 0 && !selectedTemplateId && (
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm text-gray-700">
                    Template found for{' '}
                    <span className="font-semibold">{assetType.trim()}</span>.{' '}
                    <button
                      type="button"
                      onClick={() =>
                        matchingTemplates[0].id &&
                        applyTemplate(matchingTemplates[0].id)
                      }
                      className="font-medium text-indigo-700 hover:text-indigo-900"
                    >
                      Apply {matchingTemplates[0].name}
                    </button>
                  </div>
                )}
                {templateMessage && (
                  <p className="mt-2 text-sm font-medium text-green-700">
                    {templateMessage}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Templates save only the inspection columns. Asset name and
                  location stay unique for each asset.
                </p>
              </div>

              {/* Inspection columns */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      What on {name.trim() || 'this asset'} are you inspecting?
                    </p>
                    <p className="text-xs text-gray-500">
                      Each column is saved permanently — next month reuses them
                      automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPasteMode((v) => !v)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      {pasteMode ? 'Cancel paste' : 'Paste list'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInspectionItems((items) => [
                          ...items,
                          createInspectionItem('', items.length),
                        ])
                      }
                      className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50"
                    >
                      Add column
                    </button>
                  </div>
                </div>

                {/* Paste-one-per-line */}
                {pasteMode && (
                  <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
                    <p className="mb-2 text-xs font-medium text-gray-700">
                      One label per line — added to existing columns
                    </p>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={5}
                      placeholder={
                        'Enter an inspection item\nOne label per line\n...'
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={applyPasteColumns}
                      className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Apply
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {inspectionItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => updateItem(index, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Enter an inspection item"
                      />
                      <button
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        className="rounded p-2 text-gray-400 hover:bg-white hover:text-gray-700"
                        aria-label="Move column up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        className="rounded p-2 text-gray-400 hover:bg-white hover:text-gray-700"
                        aria-label="Move column down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove column"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ── */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Import Assets via CSV
                </h2>
                <p className="text-sm text-gray-500">
                  Columns: name, assetType, locationName, recurrence, items
                  (pipe-separated), assetCode
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCsvModal(false);
                  setCsvText('');
                  setCsvErrors([]);
                  setCsvPreviewCount(0);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Close CSV modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {/* Sample download */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm text-gray-600">
                  Download a sample CSV to see the expected format.
                </p>
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                    'name,assetType,locationName,recurrence,items,assetCode\nElevator 1,Elevator,Building A,monthly,Fire recall system|Elevator communications phone,EL-01\nExit Sign B2,Exit Sign,Floor 2,monthly,Sign illuminated|Battery backup functional,ES-02\n',
                  )}`}
                  download="custom_assets_sample.csv"
                  className="flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-900"
                >
                  <Download className="h-4 w-4" />
                  Sample CSV
                </a>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Upload CSV file
                </label>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Or paste CSV text
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    const parsed = parseCsvText(e.target.value);
                    setCsvErrors(parsed.errors);
                    setCsvPreviewCount(parsed.rows.length);
                  }}
                  rows={8}
                  placeholder="name,assetType,locationName,recurrence,items,assetCode&#10;Elevator 1,Elevator,Building A,monthly,Fire recall system|Communications phone,EL-01"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {csvErrors.length > 0 && (
                <div className="rounded-md bg-red-50 px-4 py-3">
                  {csvErrors.map((e, i) => (
                    <p key={i} className="text-sm text-red-700">
                      {e}
                    </p>
                  ))}
                </div>
              )}

              {csvPreviewCount > 0 && csvErrors.length === 0 && (
                <p className="text-sm font-medium text-green-700">
                  {csvPreviewCount} asset(s) ready to import.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowCsvModal(false);
                  setCsvText('');
                  setCsvErrors([]);
                  setCsvPreviewCount(0);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCsvImport}
                disabled={
                  csvImporting || csvErrors.length > 0 || csvPreviewCount === 0
                }
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {csvImporting
                  ? 'Importing...'
                  : `Import ${csvPreviewCount > 0 ? csvPreviewCount : ''} Asset(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate from Locations Modal ── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Generate Assets from Locations
                </h2>
                <p className="text-sm text-gray-500">
                  Creates one asset per stairwell (or floor) using a starter
                  checklist. Skips duplicates automatically.
                </p>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Close generate modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {genError && (
                <p className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {genError}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Optional starter template
                </label>
                <select
                  value={genStarterId}
                  onChange={(e) => {
                    setGenStarterId(e.target.value);
                    refreshGeneratePreview(e.target.value, genRootId);
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {ASSET_STARTERS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {s.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Scope (optional — limit to a building)
                </label>
                <select
                  value={genRootId}
                  onChange={(e) => {
                    setGenRootId(e.target.value);
                    refreshGeneratePreview(genStarterId, e.target.value);
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All stairwells (org-wide)</option>
                  {buildingsWithStairwells.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {genPreview.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-gray-900">
                    Preview — {genPreview.length} asset(s) will be created
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-gray-700">
                    {genPreview.map((input, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        {input.name}
                      </li>
                    ))}
                  </ul>
                  {genSkipped.length > 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      {genSkipped.length} duplicate(s) will be skipped.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {buildingsWithStairwells.length === 0
                    ? 'No stairwells found in your locations. Add stairwell locations first.'
                    : 'No new assets to generate — all combinations already exist.'}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateConfirm}
                disabled={genRunning || genPreview.length === 0}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {genRunning
                  ? 'Creating...'
                  : `Create ${genPreview.length} Asset(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Retire Confirm ── */}
      <ConfirmModal
        open={!!retireTarget}
        title="Retire Asset"
        message={`Retire ${retireTarget?.name ?? 'this asset'}? It will no longer be seeded into active monthly inspections.`}
        confirmLabel="Retire"
        variant="warning"
        onConfirm={executeRetire}
        onCancel={() => setRetireTarget(null)}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface AssetTableProps {
  assets: CustomAsset[];
  activeWorkspace: Workspace | null;
  inspectionsByAsset: Record<string, Inspection | null>;
  answersByAsset: Record<string, Record<string, ChecklistAnswer>>;
  savingInspectionAssetId: string | null;
  canManage: boolean;
  canInspect: boolean;
  onNavigate: (id: string) => void;
  onEdit: (asset: CustomAsset) => void;
  onRetire: (asset: CustomAsset) => void;
  onSetInlineAnswer: (
    assetId: string,
    itemId: string,
    result: CustomAssetInspectionResult,
  ) => void;
  onSetInlineAnswerNotes: (
    assetId: string,
    itemId: string,
    notes: string,
  ) => void;
  onSaveInlineInspection: (asset: CustomAsset) => void;
}

function AssetTable({
  assets,
  activeWorkspace,
  inspectionsByAsset,
  answersByAsset,
  savingInspectionAssetId,
  canManage,
  canInspect,
  onNavigate,
  onEdit,
  onRetire,
  onSetInlineAnswer,
  onSetInlineAnswerNotes,
  onSaveInlineInspection,
}: AssetTableProps) {
  if (assets.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-12 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">
            No assets yet
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Add your first asset and define what you inspect on it each month.
            Starter templates are optional examples — use Custom / Blank for any
            equipment type.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1.1fr_.8fr_.75fr_2.2fr_auto] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>Asset</span>
        <span>Location</span>
        <span>Type / Code</span>
        <span>Inspection columns</span>
        <span />
      </div>
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="grid cursor-pointer grid-cols-[1.1fr_.8fr_.75fr_2.2fr_auto] items-start gap-3 border-b border-gray-100 px-4 py-3 text-sm hover:bg-gray-50 last:border-b-0"
          onClick={() => asset.id && onNavigate(asset.id)}
        >
          <div>
            <p className="font-semibold text-gray-900">{asset.name}</p>
            <p className="text-xs text-gray-500">
              {asset.status.replace(/_/g, ' ')}
            </p>
          </div>
          <span className="text-gray-600">
            {asset.locationName || 'Unassigned'}
          </span>
          <span className="text-gray-600">
            {asset.assetType || asset.assetCode || 'Asset'}
          </span>
          <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
            {!activeWorkspace ? (
              <p className="text-xs text-gray-500">
                Create this month&apos;s workspace to inspect these columns.
              </p>
            ) : (
              asset.inspectionItems
                .filter((item) => item.active)
                .sort((a, b) => a.order - b.order)
                .map((item) => {
                  const answer = asset.id
                    ? answersByAsset[asset.id]?.[item.id]
                    : undefined;
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 bg-white p-2"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-gray-900">
                          {item.label}
                        </p>
                        <div className="flex items-center gap-1">
                          {(
                            [
                              'pass',
                              'fail',
                              'na',
                            ] as CustomAssetInspectionResult[]
                          ).map((result) => (
                            <button
                              key={result}
                              type="button"
                              onClick={() =>
                                asset.id &&
                                onSetInlineAnswer(asset.id, item.id, result)
                              }
                              disabled={
                                !canInspect ||
                                inspectionsByAsset[asset.id ?? '']?.status ===
                                  'pass' ||
                                inspectionsByAsset[asset.id ?? '']?.status ===
                                  'fail'
                              }
                              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                                answer?.result === result
                                  ? result === 'pass'
                                    ? 'bg-green-600 text-white'
                                    : result === 'fail'
                                      ? 'bg-red-600 text-white'
                                      : 'bg-gray-700 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {result === 'na'
                                ? 'N/A'
                                : result === 'pass'
                                  ? 'Pass'
                                  : 'Fail'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        value={answer?.notes ?? ''}
                        onChange={(e) =>
                          asset.id &&
                          onSetInlineAnswerNotes(
                            asset.id,
                            item.id,
                            e.target.value,
                          )
                        }
                        disabled={
                          !canInspect ||
                          inspectionsByAsset[asset.id ?? '']?.status ===
                            'pass' ||
                          inspectionsByAsset[asset.id ?? '']?.status === 'fail'
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                        placeholder={`Notes for ${item.label}`}
                      />
                    </div>
                  );
                })
            )}
            {activeWorkspace &&
              canInspect &&
              asset.id &&
              inspectionsByAsset[asset.id] && (
                <button
                  type="button"
                  onClick={() => onSaveInlineInspection(asset)}
                  disabled={
                    savingInspectionAssetId === asset.id ||
                    inspectionsByAsset[asset.id]?.status === 'pass' ||
                    inspectionsByAsset[asset.id]?.status === 'fail'
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingInspectionAssetId === asset.id
                    ? 'Saving...'
                    : 'Save row'}
                </button>
              )}
          </div>
          <div className="flex items-center gap-1">
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(asset);
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
                      onRetire(asset);
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
      ))}
    </div>
  );
}

interface ElevatorTabProps {
  assets: CustomAsset[];
  inspectionsByAsset: Record<string, Inspection | null>;
  answersByAsset: Record<string, Record<string, ChecklistAnswer>>;
  canManage: boolean;
  activeWorkspace: Workspace | null;
  onNavigate: (id: string) => void;
  onEdit: (asset: CustomAsset) => void;
  onRetire: (asset: CustomAsset) => void;
}

function ElevatorTab({
  assets,
  inspectionsByAsset,
  answersByAsset,
  canManage,
  activeWorkspace,
  onNavigate,
  onEdit,
  onRetire,
}: ElevatorTabProps) {
  if (assets.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-12 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">
            No Elevator assets
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Add elevators from the Setup / All tab or use Generate from
            Locations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>Elevator</span>
        <span>Location</span>
        <span>Fire Recall</span>
        <span>Comms Phone</span>
        <span />
      </div>
      {assets.map((asset) => {
        const answers = asset.id ? answersByAsset[asset.id] : {};
        const inspection = asset.id ? inspectionsByAsset[asset.id] : null;
        const items = (
          inspection?.checklistSnapshot?.length
            ? inspection.checklistSnapshot
            : asset.inspectionItems
        ).filter((i) => i.active);

        const recallItem = items.find((i) => matchesFireRecall(i.label));
        const commsItem = items.find((i) => matchesCommsPhone(i.label));
        const recallResult = recallItem
          ? answers?.[recallItem.id]?.result
          : undefined;
        const commsResult = commsItem
          ? answers?.[commsItem.id]?.result
          : undefined;

        const overallStatus = inspection?.status;

        return (
          <div
            key={asset.id}
            className="grid cursor-pointer grid-cols-[1.5fr_1fr_1fr_1fr_auto] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm hover:bg-gray-50 last:border-b-0"
            onClick={() => asset.id && onNavigate(asset.id)}
          >
            <div>
              <p className="font-semibold text-gray-900">{asset.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                {overallStatus === 'pass' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : overallStatus === 'fail' ? (
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                ) : activeWorkspace ? (
                  <span className="text-amber-600">Pending</span>
                ) : null}
                {overallStatus && (
                  <span className="capitalize">{overallStatus}</span>
                )}
              </div>
            </div>
            <span className="text-gray-600 text-xs">
              {asset.locationName || 'Unassigned'}
            </span>
            <div>{resultBadge(recallResult)}</div>
            <div>{resultBadge(commsResult)}</div>
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(asset)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Edit elevator"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {asset.active && (
                    <button
                      type="button"
                      onClick={() => onRetire(asset)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Retire elevator"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
