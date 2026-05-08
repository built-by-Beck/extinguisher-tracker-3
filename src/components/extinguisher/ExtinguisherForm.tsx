import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth.ts';
import {
  subscribeToLocations,
  getLocationPath,
  type Location,
} from '../../services/locationService.ts';
import type { Extinguisher } from '../../services/extinguisherService.ts';

const CATEGORIES = ['standard', 'spare', 'replaced', 'retired', 'out_of_service'] as const;
const TYPES = ['ABC', 'BC', 'CO2', 'Water', 'WetChemical', 'Foam', 'CleanAgent', 'Halon', 'ClassD'] as const;
const SERVICE_CLASSES = ['storedPressure', 'cartridgeOperated', 'nonRechargeable', 'other'] as const;

type ServiceDueKind = '' | 'six_year' | 'hydro';

function timestampToDateInput(value: unknown): string {
  if (value == null) return '';
  try {
    let d: Date;
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      d = (value as { toDate: () => Date }).toDate();
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'seconds' in value &&
      typeof (value as { seconds: number }).seconds === 'number'
    ) {
      d = new Date((value as { seconds: number }).seconds * 1000);
    } else {
      return '';
    }
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

function dateInputToTimestamp(dateStr: string): Timestamp | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

interface ExtinguisherFormProps {
  initialData?: Partial<Extinguisher>;
  onSubmit: (data: Partial<Extinguisher>) => Promise<void>;
  submitLabel: string;
  loading?: boolean;
}

export function ExtinguisherForm({ initialData, onSubmit, submitLabel, loading }: ExtinguisherFormProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [locations, setLocations] = useState<Location[]>([]);

  // Subscribe to locations collection — used to populate the Section/Location dropdown
  useEffect(() => {
    if (!orgId) return;
    setLocations([]);
    return subscribeToLocations(orgId, (locs) => {
      setLocations(locs);
    });
  }, [orgId]);

  const [assetId, setAssetId] = useState(initialData?.assetId ?? '');
  const [serial, setSerial] = useState(initialData?.serial ?? '');
  const [manufacturer, setManufacturer] = useState(initialData?.manufacturer ?? '');
  const [category, setCategory] = useState(initialData?.category ?? 'standard');
  const [extinguisherType, setExtinguisherType] = useState(initialData?.extinguisherType ?? '');
  const [serviceClass, setServiceClass] = useState(initialData?.serviceClass ?? '');
  const [extinguisherSize, setExtinguisherSize] = useState(initialData?.extinguisherSize ?? '');
  const [manufactureYear, setManufactureYear] = useState<string>(initialData?.manufactureYear?.toString() ?? '');
  const [expirationYear, setExpirationYear] = useState<string>(initialData?.expirationYear?.toString() ?? '');
  const [serviceDueKind, setServiceDueKind] = useState<ServiceDueKind>('');
  const [serviceDueDate, setServiceDueDate] = useState('');
  /** When true, leaving the service-due controls unchanged avoids overwriting two stored dates. */
  const [initialHadBothServiceDates, setInitialHadBothServiceDates] = useState(false);
  const [serviceDueTouched, setServiceDueTouched] = useState(false);
  const [section, setSection] = useState(initialData?.section ?? '');
  const [locationId, setLocationId] = useState(initialData?.locationId ?? '');
  const [vicinity, setVicinity] = useState(initialData?.vicinity ?? '');
  const [parentLocation, setParentLocation] = useState(initialData?.parentLocation ?? '');
  const [barcode, setBarcode] = useState(initialData?.barcode ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setAssetId(initialData.assetId ?? '');
      setSerial(initialData.serial ?? '');
      setManufacturer(initialData.manufacturer ?? '');
      setCategory(initialData.category ?? 'standard');
      setExtinguisherType(initialData.extinguisherType ?? '');
      setServiceClass(initialData.serviceClass ?? '');
      setExtinguisherSize(initialData.extinguisherSize ?? '');
      setManufactureYear(initialData.manufactureYear?.toString() ?? '');
      setExpirationYear(initialData.expirationYear?.toString() ?? '');
      const sixTs = initialData.nextSixYearMaintenance;
      const hydroTs = initialData.nextHydroTest;
      const sixStr = timestampToDateInput(sixTs);
      const hydroStr = timestampToDateInput(hydroTs);
      if (sixStr && hydroStr) {
        setInitialHadBothServiceDates(true);
        setServiceDueKind('');
        setServiceDueDate('');
      } else {
        setInitialHadBothServiceDates(false);
        if (sixStr && !hydroStr) {
          setServiceDueKind('six_year');
          setServiceDueDate(sixStr);
        } else if (hydroStr && !sixStr) {
          setServiceDueKind('hydro');
          setServiceDueDate(hydroStr);
        } else {
          setServiceDueKind('');
          setServiceDueDate('');
        }
      }
      setServiceDueTouched(false);
      setSection(initialData.section ?? '');
      setLocationId(initialData.locationId ?? '');
      setVicinity(initialData.vicinity ?? '');
      setParentLocation(initialData.parentLocation ?? '');
      setBarcode(initialData.barcode ?? '');
    }
  }, [initialData]);

  // When a location is selected, set both parentLocation (name) and locationId (doc ID)
  function handleLocationChange(locId: string) {
    if (locId === '' || locId === '__unassigned__') {
      setParentLocation('');
      setLocationId('');
      return;
    }
    const loc = locations.find((l) => l.id === locId);
    if (loc) {
      setParentLocation(loc.name);
      setLocationId(loc.id ?? '');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!assetId.trim()) {
      setError('Asset ID is required.');
      return;
    }
    if (!serial.trim()) {
      setError('Serial number is required.');
      return;
    }

    try {
      const payload: Partial<Extinguisher> = {
        assetId: assetId.trim(),
        serial: serial.trim(),
        manufacturer: manufacturer.trim() || null,
        category,
        extinguisherType: extinguisherType || null,
        serviceClass: serviceClass || null,
        extinguisherSize: extinguisherSize.trim() || null,
        manufactureYear: manufactureYear ? parseInt(manufactureYear, 10) : null,
        expirationYear: expirationYear ? parseInt(expirationYear, 10) : null,
        section: section.trim(),
        locationId: locationId || null,
        vicinity: vicinity.trim(),
        parentLocation: parentLocation.trim(),
        barcode: barcode.trim() || null,
      };

      const skipServiceDueFields =
        initialHadBothServiceDates && !serviceDueTouched;
      if (!skipServiceDueFields) {
        let nextSixYearMaintenance: Timestamp | null = null;
        let nextHydroTest: Timestamp | null = null;
        if (serviceDueKind === 'six_year' || serviceDueKind === 'hydro') {
          const dueTs = dateInputToTimestamp(serviceDueDate);
          if (dueTs) {
            if (serviceDueKind === 'six_year') {
              nextSixYearMaintenance = dueTs;
            } else {
              nextHydroTest = dueTs;
            }
          }
        }
        payload.nextSixYearMaintenance = nextSixYearMaintenance;
        payload.nextHydroTest = nextHydroTest;
      }

      await onSubmit(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred.';
      setError(message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Identity */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wide">Identity</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="assetId" className="mb-1 block text-sm font-medium text-gray-700">
              Asset ID <span className="text-red-500">*</span>
            </label>
            <input
              id="assetId"
              type="text"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="e.g., EXT-001"
            />
          </div>
          <div>
            <label htmlFor="serial" className="mb-1 block text-sm font-medium text-gray-700">
              Serial Number <span className="text-red-500">*</span>
            </label>
            <input
              id="serial"
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <div>
            <label htmlFor="barcode" className="mb-1 block text-sm font-medium text-gray-700">
              Barcode
            </label>
            <input
              id="barcode"
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="manufacturer" className="mb-1 block text-sm font-medium text-gray-700">
              Manufacturer
            </label>
            <input
              id="manufacturer"
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* Classification */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wide">Classification</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="extType" className="mb-1 block text-sm font-medium text-gray-700">
              Type
            </label>
            <select
              id="extType"
              value={extinguisherType}
              onChange={(e) => setExtinguisherType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="">-- Select --</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="serviceClass" className="mb-1 block text-sm font-medium text-gray-700">
              Service Class
            </label>
            <select
              id="serviceClass"
              value={serviceClass}
              onChange={(e) => setServiceClass(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="">-- Select --</option>
              {SERVICE_CLASSES.map((sc) => (
                <option key={sc} value={sc}>
                  {sc.replace(/([A-Z])/g, ' $1').replace(/^./, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="size" className="mb-1 block text-sm font-medium text-gray-700">
              Size
            </label>
            <input
              id="size"
              type="text"
              value={extinguisherSize}
              onChange={(e) => setExtinguisherSize(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="e.g., 10 lb"
            />
          </div>
          <div>
            <label htmlFor="mfgYear" className="mb-1 block text-sm font-medium text-gray-700">
              Manufacture Year
            </label>
            <input
              id="mfgYear"
              type="number"
              value={manufactureYear}
              onChange={(e) => setManufactureYear(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="e.g., 2020"
            />
          </div>
          <div>
            <label htmlFor="expYear" className="mb-1 block text-sm font-medium text-gray-700">
              Expiration Year
            </label>
            <input
              id="expYear"
              type="number"
              value={expirationYear}
              onChange={(e) => setExpirationYear(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="e.g., 2032"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="serviceDueKind" className="mb-1 block text-sm font-medium text-gray-700">
              Next service due (after refill / shop work)
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Use this when manufacture and expiration years alone do not reflect the next six-year maintenance or
              hydrostatic test. Pick one type and enter the due date from the tag or service record.
            </p>
            {initialHadBothServiceDates && !serviceDueTouched ? (
              <p className="mb-2 text-xs text-amber-800">
                This unit has both a six-year and hydro due date on file. Change the options below only if you want to
                replace them with a single tracked date.
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                id="serviceDueKind"
                value={serviceDueKind}
                onChange={(e) => {
                  setServiceDueTouched(true);
                  setServiceDueKind(e.target.value as ServiceDueKind);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">Not tracking (use defaults from inspections)</option>
                <option value="six_year">Six-year maintenance</option>
                <option value="hydro">Hydrostatic test</option>
              </select>
              <input
                id="serviceDueDate"
                type="date"
                value={serviceDueDate}
                onChange={(e) => {
                  setServiceDueTouched(true);
                  setServiceDueDate(e.target.value);
                }}
                disabled={!serviceDueKind}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wide">Location</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="location" className="mb-1 block text-sm font-medium text-gray-700">
              Location
            </label>
            {locations.length > 0 ? (
              <select
                id="location"
                value={locationId || ''}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">-- Unassigned --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id ?? ''}>
                    {getLocationPath(locations, loc.id!)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-400">
                No locations configured. Add locations on the Locations page first.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="vicinity" className="mb-1 block text-sm font-medium text-gray-700">
              Vicinity
            </label>
            <input
              id="vicinity"
              type="text"
              value={vicinity}
              onChange={(e) => setVicinity(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="e.g., Near elevator B, East wall"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
