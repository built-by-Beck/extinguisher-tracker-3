import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
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

export const LOCATION_TYPES = [
  'campus',
  'building',
  'floor',
  'wing',
  'zone',
  'room',
  'mechanical',
  'outdoor',
  'other',
] as const;

function locationsRef(orgId: string) {
  return collection(db, 'org', orgId, 'locations');
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
