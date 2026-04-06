import { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Plus,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import {
  subscribeToLocations,
  createLocation,
  updateLocation,
  softDeleteLocation,
  buildLocationTree,
  isLocationNameTaken,
  LOCATION_TYPE_ENTRIES,
  getLocationTypeLabel,
  type Location,
  type LocationTreeNode,
} from '../services/locationService.ts';
import { cacheLocations } from '../services/offlineCacheService.ts';

function TreeNode({
  node,
  depth,
  canEdit,
  onEdit,
  onDelete,
}: {
  node: LocationTreeNode;
  depth: number;
  canEdit: boolean;
  onEdit: (loc: Location) => void;
  onDelete: (loc: Location) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{node.name}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
            Level {depth + 1}
          </span>
        </div>
        <span className="text-xs text-gray-400">{getLocationTypeLabel(node.locationType)}</span>

        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(node)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(node)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            canEdit={canEdit}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

export default function Locations() {
  const { user, userProfile } = useAuth();
  const { hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canEdit = hasRole(['owner', 'admin']);

  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('building');
  const [formParent, setFormParent] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, (locs) => {
      setLocations(locs);
      // Cache on read (fire-and-forget)
      cacheLocations(orgId, locs as unknown as Array<Record<string, unknown>>).catch(
        () => undefined,
      );
    });
  }, [orgId]);

  const tree = buildLocationTree(locations);

  function openCreate() {
    setEditingLoc(null);
    setFormName('');
    setFormType('building');
    setFormParent('');
    setFormDescription('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(loc: Location) {
    setEditingLoc(loc);
    setFormName(loc.name);
    setFormType(loc.locationType);
    setFormParent(loc.parentLocationId ?? '');
    setFormDescription(loc.description ?? '');
    setFormError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (!orgId || !user) return;

    setFormSaving(true);
    setFormError('');

    try {
      const parentId = formParent || null;
      // Check for duplicate name under same parent
      const taken = await isLocationNameTaken(
        orgId,
        formName.trim(),
        parentId,
        editingLoc?.id,
      );
      if (taken) {
        setFormError('A location with this name already exists under the same parent. Use a unique name.');
        setFormSaving(false);
        return;
      }

      const data: Partial<Location> = {
        name: formName.trim(),
        locationType: formType,
        parentLocationId: parentId,
        description: formDescription.trim() || null,
      };

      if (editingLoc?.id) {
        await updateLocation(orgId, editingLoc.id, data);
      } else {
        await createLocation(orgId, user.uid, data);
      }

      setShowForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setFormSaving(false);
    }
  }

  function handleDeleteRequest(loc: Location) {
    if (!orgId || !loc.id) return;
    setDeleteTarget(loc);
  }

  const executeDelete = useCallback(async () => {
    if (!orgId || !deleteTarget?.id) return;
    try {
      await softDeleteLocation(orgId, deleteTarget.id);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete location.');
    } finally {
      setDeleteTarget(null);
    }
  }, [orgId, deleteTarget]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize your facilities into a hierarchy for easy navigation.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Add Location
          </button>
        )}
      </div>

      {/* Tree view */}
      {locations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No locations yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add buildings, floors, rooms, and other areas to organize your extinguishers.
          </p>
          {canEdit && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add Location
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              canEdit={canEdit}
              onEdit={openEdit}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      {/* Create/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLoc ? 'Edit Location' : 'Add Location'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="e.g., Building A"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {!LOCATION_TYPE_ENTRIES.some(([v]) => v === formType) && formType ? (
                    <option value={formType}>{getLocationTypeLabel(formType)}</option>
                  ) : null}
                  {LOCATION_TYPE_ENTRIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Parent Location</label>
                <select
                  value={formParent}
                  onChange={(e) => setFormParent(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="">-- None (top-level) --</option>
                  {locations
                    .filter((l) => l.id !== editingLoc?.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({getLocationTypeLabel(l.locationType)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={formSaving}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {formSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingLoc ? 'Save Changes' : 'Add Location'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete Location"
        message={`Delete location "${deleteTarget?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
