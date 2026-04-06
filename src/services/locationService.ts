import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';

export interface Location {
  id?: string;
  name: string;
  parentLocationId: string | null;
  locationType: string;
  section: string | null;
  description: string | null;
  address: string | null;
  gps: { lat: number; lng: number } | null;
  sortOrder: number;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
  deletedAt: unknown | null;
}

/** [stored value, label shown in UI] — values are stable for Firestore; labels can change. */
export const LOCATION_TYPE_ENTRIES = [
  // Structural (common hierarchy)
  ['campus', 'Campus'],
  ['building', 'Building'],
  ['floor', 'Floor'],
  ['wing', 'Wing'],
  ['zone', 'Zone'],
  // Alphabetical by label
  ['apartment', 'Apartment'],
  ['attic', 'Attic'],
  ['basement', 'Basement'],
  ['boiler_room', 'Boiler room'],
  ['break_room', 'Break room'],
  ['cafeteria', 'Cafeteria'],
  ['classroom', 'Classroom'],
  ['closet', 'Closet'],
  ['conference_room', 'Conference room'],
  ['courtyard', 'Courtyard'],
  ['dining_room', 'Dining room'],
  ['driveway', 'Driveway'],
  ['electrical_room', 'Electrical room'],
  ['elevator_lobby', 'Elevator lobby'],
  ['entrance', 'Entrance'],
  ['exam_room', 'Exam room'],
  ['exit', 'Exit'],
  ['fence_line', 'Fence line'],
  ['gate', 'Gate'],
  ['generator_room', 'Generator room'],
  ['hallway', 'Hallway'],
  ['icu', 'ICU'],
  ['kitchen', 'Kitchen'],
  ['lab', 'Lab'],
  ['loading_dock', 'Loading dock'],
  ['lobby', 'Lobby'],
  ['maintenance_room', 'Maintenance room'],
  ['mechanical', 'Mechanical'],
  ['mechanical_room', 'Mechanical room'],
  ['nurse_station', 'Nurse station'],
  ['office', 'Office'],
  ['operating_room', 'Operating room'],
  ['outdoor', 'Outdoor'],
  ['outdoor_walkway', 'Outdoor walkway'],
  ['parking_deck', 'Parking deck'],
  ['parking_lot', 'Parking lot'],
  ['patient_room', 'Patient room'],
  ['reception_area', 'Reception area'],
  ['restroom', 'Restroom'],
  ['roof', 'Roof'],
  ['room', 'Room'],
  ['security_office', 'Security office'],
  ['server_room', 'Server room'],
  ['shop', 'Shop'],
  ['stairwell', 'Stairwell'],
  ['storage_room', 'Storage room'],
  ['suite', 'Suite'],
  ['utility_area', 'Utility area'],
  ['waiting_area', 'Waiting area'],
  ['warehouse', 'Warehouse'],
  ['other', 'Other'],
] as const;

export const LOCATION_TYPES = LOCATION_TYPE_ENTRIES.map((e) => e[0]);

export function getLocationTypeLabel(value: string): string {
  const found = LOCATION_TYPE_ENTRIES.find((e) => e[0] === value);
  if (found) return found[1];
  return value
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function locationsRef(orgId: string) {
  return collection(db, 'org', orgId, 'locations');
}

/**
 * Normalize a location name for uniqueness comparison.
 * Trims whitespace, collapses multiple spaces, lowercases.
 */
export function normalizeLocationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Check if a location name already exists under the same parent.
 * Returns true if the name is taken (case-insensitive, trimmed).
 */
export async function isLocationNameTaken(
  orgId: string,
  name: string,
  parentLocationId: string | null,
  excludeId?: string,
): Promise<boolean> {
  const q = query(
    locationsRef(orgId),
    where('deletedAt', '==', null),
  );
  const snap = await getDocs(q);
  const normalized = normalizeLocationName(name);

  for (const d of snap.docs) {
    if (excludeId && d.id === excludeId) continue;
    const data = d.data();
    const existingName = normalizeLocationName((data.name as string) ?? '');
    const existingParent = (data.parentLocationId as string | null) ?? null;
    if (existingName === normalized && existingParent === parentLocationId) {
      return true;
    }
  }
  return false;
}

/**
 * Create a new location.
 */
export async function createLocation(
  orgId: string,
  uid: string,
  data: Partial<Location>,
): Promise<string> {
  const docData = {
    name: data.name ?? '',
    parentLocationId: data.parentLocationId ?? null,
    locationType: data.locationType ?? 'other',
    section: data.section ?? null,
    description: data.description ?? null,
    address: data.address ?? null,
    gps: data.gps ?? null,
    sortOrder: data.sortOrder ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    deletedAt: null,
  };

  const docRef = await addDoc(locationsRef(orgId), docData);
  return docRef.id;
}

/**
 * Update a location.
 */
export async function updateLocation(
  orgId: string,
  locId: string,
  data: Partial<Location>,
): Promise<void> {
  const ref = doc(db, 'org', orgId, 'locations', locId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Soft-delete a location.
 */
export async function softDeleteLocation(orgId: string, locId: string): Promise<void> {
  const ref = doc(db, 'org', orgId, 'locations', locId);
  await updateDoc(ref, {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Subscribe to all active locations for an org.
 */
export function subscribeToLocations(
  orgId: string,
  callback: (items: Location[]) => void,
): () => void {
  const q = query(
    locationsRef(orgId),
    where('deletedAt', '==', null),
    orderBy('sortOrder', 'asc'),
  );

  return onSnapshot(q, (snap) => {
    const items: Location[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Location[];
    callback(items);
  });
}

/**
 * Build a tree structure from flat locations list.
 */
export interface LocationTreeNode extends Location {
  children: LocationTreeNode[];
}

export function buildLocationTree(locations: Location[]): LocationTreeNode[] {
  const map = new Map<string, LocationTreeNode>();
  const roots: LocationTreeNode[] = [];

  // Create nodes
  for (const loc of locations) {
    map.set(loc.id!, { ...loc, children: [] });
  }

  // Build tree
  for (const node of map.values()) {
    if (node.parentLocationId && map.has(node.parentLocationId)) {
      map.get(node.parentLocationId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Get all descendant location IDs for a given location (recursive).
 */
export function getAllDescendantIds(locations: Location[], locationId: string): Set<string> {
  const childMap = new Map<string, string[]>();
  for (const loc of locations) {
    if (loc.parentLocationId) {
      const children = childMap.get(loc.parentLocationId) ?? [];
      children.push(loc.id!);
      childMap.set(loc.parentLocationId, children);
    }
  }

  const result = new Set<string>();
  const stack = [locationId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childMap.get(current) ?? [];
    for (const childId of children) {
      result.add(childId);
      stack.push(childId);
    }
  }
  return result;
}

/**
 * Get ancestor chain for a location (from root to immediate parent).
 */
export function getAncestorChain(locations: Location[], locationId: string): Location[] {
  const map = new Map(locations.map((l) => [l.id!, l]));
  const ancestors: Location[] = [];
  let current = map.get(locationId);

  while (current?.parentLocationId) {
    const parent = map.get(current.parentLocationId);
    if (parent) {
      ancestors.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }
  return ancestors;
}

/**
 * Get the full path for a location (e.g., "Campus A > Building 2 > Floor 3").
 */
export function getLocationPath(locations: Location[], locationId: string): string {
  const map = new Map(locations.map((l) => [l.id!, l]));
  const parts: string[] = [];
  let current = map.get(locationId);

  while (current) {
    parts.unshift(current.name);
    current = current.parentLocationId ? map.get(current.parentLocationId) : undefined;
  }

  return parts.join(' > ');
}
