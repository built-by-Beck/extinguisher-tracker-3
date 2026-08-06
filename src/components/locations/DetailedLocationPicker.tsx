/**
 * DetailedLocationPicker — cascading Building → Floor → Sub-location → Vicinity.
 * Optional segments can be hidden; hidden fields clear their values.
 *
 * Author: built_by_Beck
 */

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.ts';
import {
  deriveLocationFields,
  deepestLocationId,
  getBuildingLevelLocations,
  getChildrenOfType,
  getDirectChildren,
  getLocationPath,
  isFloorLevelType,
  resolvePickerCascade,
  subscribeToLocations,
  type Location,
} from '../../services/locationService.ts';

export type DetailedLocationPickerMode = 'assign' | 'filter';

export type DetailedLocationVisibleFields = {
  floor: boolean;
  subLocation: boolean;
  vicinity: boolean;
};

export interface DetailedLocationValue {
  locationId: string | null;
  /** Denormalized building/campus name. */
  parentLocation: string;
  floor: string;
  section: string;
  vicinity: string;
  locationPath: string;
  buildingId: string | null;
  floorId: string | null;
  subLocationId: string | null;
}

export interface DetailedLocationPickerProps {
  /** Stored deepest location id. */
  locationId?: string | null;
  vicinity?: string;
  /** Existing denormalized floor label (preserved when hierarchy has no floor node). */
  floorLabel?: string;
  mode?: DetailedLocationPickerMode;
  /** External locations list — skips internal subscription when provided. */
  locations?: Location[];
  onChange: (value: DetailedLocationValue) => void;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_VISIBLE_ASSIGN: DetailedLocationVisibleFields = {
  floor: true,
  subLocation: true,
  vicinity: true,
};

const DEFAULT_VISIBLE_FILTER: DetailedLocationVisibleFields = {
  floor: true,
  subLocation: false,
  vicinity: false,
};

function emitFromCascade(
  locations: Location[],
  buildingId: string | null,
  floorId: string | null,
  subLocationId: string | null,
  vicinity: string,
  options?: { preserveFloor?: string; clearFloor?: boolean },
): DetailedLocationValue {
  const id = deepestLocationId(buildingId, floorId, subLocationId);
  const derived = deriveLocationFields(locations, id, vicinity);
  if (options?.clearFloor) {
    return { ...derived, floor: '' };
  }
  if (!derived.floor && options?.preserveFloor?.trim()) {
    return { ...derived, floor: options.preserveFloor.trim() };
  }
  return derived;
}

export function DetailedLocationPicker({
  locationId = null,
  vicinity: vicinityProp = '',
  floorLabel: floorLabelProp = '',
  mode = 'assign',
  locations: locationsProp,
  onChange,
  className = '',
  disabled = false,
}: DetailedLocationPickerProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';
  const [subscribed, setSubscribed] = useState<Location[]>([]);
  const locations = locationsProp ?? subscribed;

  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [subLocationId, setSubLocationId] = useState<string | null>(null);
  const [vicinity, setVicinity] = useState(vicinityProp);
  const [preservedFloor, setPreservedFloor] = useState(floorLabelProp);
  const [visible, setVisible] = useState<DetailedLocationVisibleFields>(
    mode === 'filter' ? DEFAULT_VISIBLE_FILTER : DEFAULT_VISIBLE_ASSIGN,
  );

  useEffect(() => {
    if (locationsProp || !orgId) return;
    return subscribeToLocations(orgId, setSubscribed);
  }, [orgId, locationsProp]);

  // Hydrate cascade when the stored locationId changes (not on every snapshot).
  useEffect(() => {
    if (locations.length === 0) return;
    const cascade = resolvePickerCascade(locations, locationId);
    setBuildingId(cascade.buildingId);
    setFloorId(cascade.floorId);
    setSubLocationId(cascade.subLocationId);
    setPreservedFloor(
      cascade.floorId
        ? ''
        : floorLabelProp || '',
    );
    setVisible((prev) => ({
      floor:
        cascade.floorId != null || Boolean(floorLabelProp?.trim())
          ? true
          : prev.floor,
      subLocation: cascade.subLocationId != null ? true : prev.subLocation,
      vicinity: vicinityProp?.trim() ? true : prev.vicinity,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate on locationId only
  }, [locationId, locations.length]);

  useEffect(() => {
    setVicinity(vicinityProp ?? '');
  }, [vicinityProp]);

  useEffect(() => {
    // Keep denorm floor in sync when parent reloads the same locationId.
    if (!floorId) {
      setPreservedFloor(floorLabelProp || '');
    }
  }, [floorLabelProp, floorId]);

  const buildings = useMemo(
    () => getBuildingLevelLocations(locations),
    [locations],
  );

  const floorOptions = useMemo(() => {
    if (!buildingId) return [];
    const floors = getDirectChildren(locations, buildingId).filter((l) =>
      isFloorLevelType(l.locationType),
    );
    if (floors.length > 0) return floors;
    return getChildrenOfType(locations, buildingId, 'floor');
  }, [locations, buildingId]);

  const subLocationOptions = useMemo(() => {
    const parent = visible.floor && floorId ? floorId : buildingId;
    if (!parent) return [];
    return getDirectChildren(locations, parent).filter(
      (l) => !isFloorLevelType(l.locationType),
    );
  }, [locations, buildingId, floorId, visible.floor]);

  function pushChange(
    nextBuilding: string | null,
    nextFloor: string | null,
    nextSub: string | null,
    nextVicinity: string,
    options?: { preserveFloor?: string; clearFloor?: boolean },
  ) {
    onChange(
      emitFromCascade(
        locations,
        nextBuilding,
        nextFloor,
        nextSub,
        nextVicinity,
        {
          preserveFloor: options?.clearFloor
            ? undefined
            : (options?.preserveFloor ??
              (nextFloor ? undefined : preservedFloor)),
          clearFloor: options?.clearFloor,
        },
      ),
    );
  }

  function hideField(field: keyof DetailedLocationVisibleFields) {
    const nextVisible = { ...visible, [field]: false };
    setVisible(nextVisible);
    if (field === 'floor') {
      setFloorId(null);
      setPreservedFloor('');
      const underBuilding = buildingId
        ? getDirectChildren(locations, buildingId).filter(
            (l) => !isFloorLevelType(l.locationType),
          )
        : [];
      const keptSub =
        subLocationId && underBuilding.some((l) => l.id === subLocationId)
          ? subLocationId
          : null;
      setSubLocationId(keptSub);
      pushChange(buildingId, null, keptSub, vicinity, { clearFloor: true });
    } else if (field === 'subLocation') {
      setSubLocationId(null);
      pushChange(buildingId, visible.floor ? floorId : null, null, vicinity);
    } else if (field === 'vicinity') {
      setVicinity('');
      pushChange(
        buildingId,
        visible.floor ? floorId : null,
        visible.subLocation ? subLocationId : null,
        '',
      );
    }
  }

  function showField(field: keyof DetailedLocationVisibleFields) {
    setVisible((v) => ({ ...v, [field]: true }));
  }

  if (locations.length === 0) {
    return (
      <div className={`text-sm text-gray-400 ${className}`}>
        <MapPin className="mr-1 inline h-4 w-4" />
        No locations defined. Add locations in the Locations page.
      </div>
    );
  }

  const selectClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100';

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Location / Building */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Location
        </label>
        <select
          value={buildingId ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value || null;
            setBuildingId(next);
            setFloorId(null);
            setSubLocationId(null);
            // Changing building drops legacy denorm floor — reassign explicitly.
            setPreservedFloor('');
            pushChange(next, null, null, vicinity, { clearFloor: true });
          }}
          className={selectClass}
        >
          <option value="">
            {mode === 'filter'
              ? '-- All Locations --'
              : '-- Select location --'}
          </option>
          {buildings.map((loc) => (
            <option key={loc.id} value={loc.id!}>
              {getLocationPath(locations, loc.id!)}
            </option>
          ))}
        </select>
      </div>

      {/* Floor */}
      {visible.floor && (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Floor
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => hideField('floor')}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
              title="Remove floor field"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
          <select
            value={floorId ?? ''}
            disabled={disabled || !buildingId}
            onChange={(e) => {
              const next = e.target.value || null;
              setFloorId(next);
              setSubLocationId(null);
              if (next) setPreservedFloor('');
              pushChange(buildingId, next, null, vicinity, {
                clearFloor: !next && !preservedFloor,
                preserveFloor: next ? undefined : preservedFloor,
              });
            }}
            className={selectClass}
          >
            <option value="">-- Select floor --</option>
            {floorOptions.map((loc) => (
              <option key={loc.id} value={loc.id!}>
                {loc.name}
              </option>
            ))}
          </select>
          {buildingId && floorOptions.length === 0 && (
            <div className="mt-2">
              <input
                type="text"
                value={preservedFloor}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.value;
                  setPreservedFloor(next);
                  pushChange(buildingId, null, subLocationId, vicinity, {
                    preserveFloor: next,
                    clearFloor: !next.trim(),
                  });
                }}
                className={selectClass}
                placeholder="e.g., Floor 4, Basement"
              />
              <p className="mt-1 text-xs text-gray-500">
                No floor locations under this building yet. Enter a floor label
                or add floors on the Locations page.
              </p>
            </div>
          )}
          {buildingId &&
            floorOptions.length > 0 &&
            !floorId &&
            preservedFloor.trim() && (
              <p className="mt-1 text-xs text-amber-800">
                Current floor label: {preservedFloor}. Pick a floor above to
                link it to the hierarchy, or leave as-is.
              </p>
            )}
        </div>
      )}

      {/* Sub-location */}
      {visible.subLocation && (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Sub-location
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => hideField('subLocation')}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
              title="Remove sub-location field"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
          <select
            value={subLocationId ?? ''}
            disabled={disabled || !buildingId}
            onChange={(e) => {
              const next = e.target.value || null;
              setSubLocationId(next);
              pushChange(
                buildingId,
                visible.floor ? floorId : null,
                next,
                vicinity,
              );
            }}
            className={selectClass}
          >
            <option value="">-- Select sub-location --</option>
            {subLocationOptions.map((loc) => (
              <option key={loc.id} value={loc.id!}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Vicinity */}
      {visible.vicinity && (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Vicinity
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => hideField('vicinity')}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
              title="Remove vicinity field"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
          <input
            type="text"
            value={vicinity}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value;
              setVicinity(next);
              pushChange(
                buildingId,
                visible.floor ? floorId : null,
                visible.subLocation ? subLocationId : null,
                next,
              );
            }}
            className={selectClass}
            placeholder="e.g., near elevator, east wall"
          />
        </div>
      )}

      {/* Re-add hidden optional fields */}
      {(!visible.floor || !visible.subLocation || !visible.vicinity) && (
        <div className="flex flex-wrap gap-2">
          {!visible.floor && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => showField('floor')}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add floor
            </button>
          )}
          {!visible.subLocation && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => showField('subLocation')}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add sub-location
            </button>
          )}
          {!visible.vicinity && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => showField('vicinity')}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add vicinity
            </button>
          )}
        </div>
      )}
    </div>
  );
}
