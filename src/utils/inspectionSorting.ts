import type { Extinguisher } from '../services/extinguisherService.ts';
import type { Inspection } from '../services/inspectionService.ts';
import type { Location } from '../services/locationService.ts';

export type InspectionSortMode = 'table' | 'numeric' | 'floor' | 'spatial';

const NATURAL_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function cmpNatural(a: string, b: string): number {
  return NATURAL_COLLATOR.compare(a, b);
}

function norm(v: unknown): string {
  return (v ?? '').toString().trim();
}

function getFloorRank(text: string): number {
  const t = text.toLowerCase();
  if (!t) return Number.MAX_SAFE_INTEGER;
  if (/\b(basement|bmt|b\d+)\b/.test(t)) return -1;
  if (/\b(ground|grnd|g)\b/.test(t)) return 0;
  if (/\b(mezzanine|mezz)\b/.test(t)) return 1;
  if (/\b(penthouse|ph)\b/.test(t)) return 999;
  const ordinal = t.match(/\b(\d{1,3})(?:st|nd|rd|th)?\s*(?:floor|fl)?\b/);
  if (ordinal) return Number.parseInt(ordinal[1], 10);
  return Number.MAX_SAFE_INTEGER;
}

function getRoomRank(text: string): number {
  const match = text.match(/\b(\d{1,5})\b/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number.parseInt(match[1], 10);
}

function buildLookup(extinguishers: Extinguisher[], locations: Location[]) {
  const extById = new Map<string, Extinguisher>();
  for (const e of extinguishers) {
    if (e.id) extById.set(e.id, e);
  }

  const locById = new Map<string, Location>();
  for (const loc of locations) {
    if (loc.id) locById.set(loc.id, loc);
  }

  return { extById, locById };
}

function locationPathSortOrder(locationId: string | null | undefined, locById: ReadonlyMap<string, Location>): string {
  if (!locationId) return 'zzz-unassigned';
  const parts: string[] = [];
  let current = locById.get(locationId);
  while (current) {
    const order = Number.isFinite(current.sortOrder) ? String(current.sortOrder).padStart(6, '0') : '999999';
    parts.unshift(`${order}:${current.name.toLowerCase()}`);
    if (!current.parentLocationId) break;
    current = locById.get(current.parentLocationId);
  }
  return parts.join('>');
}

function getVicinity(insp: Inspection, extById: ReadonlyMap<string, Extinguisher>): string {
  return norm(extById.get(insp.extinguisherId)?.vicinity || insp.section).toLowerCase();
}

function tableSortValue(
  insp: Inspection,
  sortKey: string,
  extById: ReadonlyMap<string, Extinguisher>,
): string {
  if (sortKey === 'vicinity') return getVicinity(insp, extById);
  return norm(insp[sortKey as keyof Inspection]).toLowerCase();
}

export function sortInspectionsByMode(params: {
  list: Inspection[];
  mode: InspectionSortMode;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  extinguishers: Extinguisher[];
  locations: Location[];
}): Inspection[] {
  const { list, mode, sortKey, sortDir, extinguishers, locations } = params;
  const { extById, locById } = buildLookup(extinguishers, locations);
  const dir = sortDir === 'asc' ? 1 : -1;

  const sorted = [...list].sort((a, b) => {
    if (mode === 'table') {
      return cmpNatural(tableSortValue(a, sortKey, extById), tableSortValue(b, sortKey, extById)) * dir;
    }

    if (mode === 'numeric') {
      const byAsset = cmpNatural(norm(a.assetId), norm(b.assetId));
      if (byAsset !== 0) return byAsset * dir;
      return cmpNatural(getVicinity(a, extById), getVicinity(b, extById)) * dir;
    }

    if (mode === 'floor') {
      const aArea = `${getVicinity(a, extById)} ${norm(a.section)}`.trim();
      const bArea = `${getVicinity(b, extById)} ${norm(b.section)}`.trim();
      const byFloor = getFloorRank(aArea) - getFloorRank(bArea);
      if (byFloor !== 0) return byFloor * dir;
      const byRoom = getRoomRank(aArea) - getRoomRank(bArea);
      if (byRoom !== 0) return byRoom * dir;
      return cmpNatural(aArea, bArea) * dir;
    }

    const pathA = locationPathSortOrder(a.locationId, locById);
    const pathB = locationPathSortOrder(b.locationId, locById);
    const byPath = cmpNatural(pathA, pathB);
    if (byPath !== 0) return byPath * dir;
    const byVicinity = cmpNatural(getVicinity(a, extById), getVicinity(b, extById));
    if (byVicinity !== 0) return byVicinity * dir;
    return cmpNatural(norm(a.assetId), norm(b.assetId)) * dir;
  });

  return sorted;
}
