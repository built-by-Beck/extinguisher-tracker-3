/**
 * Fire Extinguisher Calculator — native NFPA 10 based calculator.
 * Calculates minimum number of extinguishers based on square footage,
 * hazard class, occupancy type, and number of floors.
 *
 * Reference: NFPA 10 Table 6.2.1.1 (Class A), Table 6.3.1.1 (Class B)
 *
 * DISCLAIMER: For reference only — consult a fire protection professional.
 *
 * Author: built_by_Beck
 */

import { useState } from 'react';
import { Calculator as CalcIcon, AlertTriangle, Info } from 'lucide-react';

type HazardClass = 'light' | 'ordinary' | 'extra';
type OccupancyType = 'office' | 'warehouse' | 'manufacturing' | 'retail' | 'education' | 'healthcare' | 'other';

interface CalculationResult {
  minExtinguishers: number;
  maxTravelDistanceFt: number;
  maxFloorAreaPerUnit: number;
  recommendedTypes: string[];
  recommendedRating: string;
  notes: string[];
}

/**
 * NFPA 10 Table 6.2.1.1 — Class A fire extinguisher requirements
 * - Light hazard:    max 6,000 sq ft per unit, 75 ft travel distance, min 2-A rating
 * - Ordinary hazard: max 3,000 sq ft per unit, 75 ft travel distance, min 2-A rating
 * - Extra hazard:    max 3,000 sq ft per unit, 75 ft travel distance, min 4-A rating
 *
 * NFPA 10 Table 6.3.1.1 — Class B travel distances
 * - Light hazard:    50 ft travel distance
 * - Ordinary hazard: 50 ft travel distance
 * - Extra hazard:    50 ft travel distance
 */
const NFPA_CLASS_A: Record<HazardClass, { maxAreaPerUnit: number; travelDistance: number; minRating: string }> = {
  light:    { maxAreaPerUnit: 6000, travelDistance: 75, minRating: '2-A' },
  ordinary: { maxAreaPerUnit: 3000, travelDistance: 75, minRating: '2-A' },
  extra:    { maxAreaPerUnit: 3000, travelDistance: 75, minRating: '4-A' },
};

const HAZARD_LABELS: Record<HazardClass, string> = {
  light: 'Light (Low) Hazard',
  ordinary: 'Ordinary (Moderate) Hazard',
  extra: 'Extra (High) Hazard',
};

const OCCUPANCY_LABELS: Record<OccupancyType, string> = {
  office: 'Office / Business',
  warehouse: 'Warehouse / Storage',
  manufacturing: 'Manufacturing / Industrial',
  retail: 'Retail / Mercantile',
  education: 'Education',
  healthcare: 'Healthcare',
  other: 'Other',
};

const OCCUPANCY_HAZARD_GUIDANCE: Record<OccupancyType, HazardClass> = {
  office: 'light',
  warehouse: 'ordinary',
  manufacturing: 'extra',
  retail: 'ordinary',
  education: 'light',
  healthcare: 'light',
  other: 'ordinary',
};

function getRecommendedTypes(hazard: HazardClass): string[] {
  switch (hazard) {
    case 'light':
      return ['ABC Dry Chemical (5 lb or 10 lb)', 'Water Mist', 'Clean Agent'];
    case 'ordinary':
      return ['ABC Dry Chemical (10 lb or 20 lb)', 'CO2 (10 lb or 15 lb)'];
    case 'extra':
      return ['ABC Dry Chemical (20 lb)', 'Purple K (20 lb)', 'CO2 (15 lb or 20 lb)'];
  }
}

function calculate(
  sqft: number,
  hazard: HazardClass,
  floors: number,
): CalculationResult {
  const config = NFPA_CLASS_A[hazard];
  const totalArea = sqft * Math.max(floors, 1);
  const minFromArea = Math.ceil(totalArea / config.maxAreaPerUnit);
  // Minimum 1 per floor
  const minFromFloors = Math.max(floors, 1);
  const minExtinguishers = Math.max(minFromArea, minFromFloors);

  const notes: string[] = [];
  notes.push(`Based on ${HAZARD_LABELS[hazard]} classification`);
  notes.push(`Total area: ${totalArea.toLocaleString()} sq ft (${sqft.toLocaleString()} sq ft x ${floors} floor${floors !== 1 ? 's' : ''})`);
  notes.push(`Maximum area per extinguisher: ${config.maxAreaPerUnit.toLocaleString()} sq ft`);
  notes.push(`Maximum travel distance to nearest extinguisher: ${config.travelDistance} ft`);
  if (minFromFloors > minFromArea) {
    notes.push(`Minimum of 1 extinguisher per floor applied (${floors} floors)`);
  }
  if (hazard === 'extra') {
    notes.push('Extra hazard areas may require additional Class B:C rated extinguishers');
  }

  return {
    minExtinguishers,
    maxTravelDistanceFt: config.travelDistance,
    maxFloorAreaPerUnit: config.maxAreaPerUnit,
    recommendedTypes: getRecommendedTypes(hazard),
    recommendedRating: config.minRating,
    notes,
  };
}

export default function Calculator() {
  const [sqft, setSqft] = useState('');
  const [hazard, setHazard] = useState<HazardClass>('ordinary');
  const [occupancy, setOccupancy] = useState<OccupancyType>('office');
  const [floors, setFloors] = useState('1');
  const [result, setResult] = useState<CalculationResult | null>(null);

  function handleOccupancyChange(occ: OccupancyType) {
    setOccupancy(occ);
    setHazard(OCCUPANCY_HAZARD_GUIDANCE[occ]);
  }

  function handleCalculate() {
    const sqftNum = parseInt(sqft, 10);
    const floorsNum = parseInt(floors, 10);
    if (!sqftNum || sqftNum <= 0) return;
    setResult(calculate(sqftNum, hazard, floorsNum || 1));
  }

  function handleReset() {
    setSqft('');
    setHazard('ordinary');
    setOccupancy('office');
    setFloors('1');
    setResult(null);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-50 p-2">
            <CalcIcon className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fire Extinguisher Calculator</h1>
            <p className="text-sm text-gray-500">
              NFPA 10 based calculation for minimum extinguisher requirements
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Building Information</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="sqft" className="mb-1 block text-sm font-medium text-gray-700">
                Square Footage (per floor)
              </label>
              <input
                id="sqft"
                type="number"
                min="1"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label htmlFor="floors" className="mb-1 block text-sm font-medium text-gray-700">
                Number of Floors
              </label>
              <input
                id="floors"
                type="number"
                min="1"
                max="200"
                value={floors}
                onChange={(e) => setFloors(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label htmlFor="occupancy" className="mb-1 block text-sm font-medium text-gray-700">
                Occupancy Type
              </label>
              <select
                id="occupancy"
                value={occupancy}
                onChange={(e) => handleOccupancyChange(e.target.value as OccupancyType)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {(Object.keys(OCCUPANCY_LABELS) as OccupancyType[]).map((key) => (
                  <option key={key} value={key}>
                    {OCCUPANCY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="hazard" className="mb-1 block text-sm font-medium text-gray-700">
                Hazard Classification
              </label>
              <select
                id="hazard"
                value={hazard}
                onChange={(e) => setHazard(e.target.value as HazardClass)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {(Object.keys(HAZARD_LABELS) as HazardClass[]).map((key) => (
                  <option key={key} value={key}>
                    {HAZARD_LABELS[key]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Auto-set based on occupancy type. Override if needed.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCalculate}
                disabled={!sqft || parseInt(sqft, 10) <= 0}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Calculate
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Results</h2>

                <div className="mb-6 rounded-lg bg-red-50 p-4 text-center">
                  <p className="text-sm font-medium text-red-700">Minimum Extinguishers Required</p>
                  <p className="mt-1 text-4xl font-bold text-red-600">{result.minExtinguishers}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-medium text-gray-500">Max Travel Distance</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{result.maxTravelDistanceFt} ft</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-medium text-gray-500">Max Area Per Unit</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{result.maxFloorAreaPerUnit.toLocaleString()} sq ft</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-medium text-gray-500">Minimum Rating</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{result.recommendedRating}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">Recommended Types</h3>
                  <ul className="space-y-1">
                    {result.recommendedTypes.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Info className="h-4 w-4 text-blue-500" />
                  Calculation Details
                </h3>
                <ul className="space-y-1">
                  {result.notes.map((n, i) => (
                    <li key={i} className="text-xs text-gray-600">{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12">
              <div className="text-center">
                <CalcIcon className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 text-sm font-medium text-gray-600">
                  Enter building details and click Calculate
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Results will appear here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-xs text-amber-800">
          <p className="font-semibold">Disclaimer</p>
          <p className="mt-1">
            This calculator provides estimates based on NFPA 10 general requirements for Class A
            hazards. Actual requirements may vary based on local codes, specific hazard types (Class
            B/C/D/K), building layout, egress paths, and Authority Having Jurisdiction (AHJ)
            requirements. Always consult a licensed fire protection professional for site-specific
            recommendations.
          </p>
        </div>
      </div>
    </div>
  );
}
