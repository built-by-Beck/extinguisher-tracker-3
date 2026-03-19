/**
 * Offline cache service for EX3.
 *
 * Implements cache-on-read pattern: as the user views data via Firestore
 * onSnapshot listeners, we write copies to IndexedDB. When offline, pages
 * fall back to these cached copies.
 *
 * Org-isolation is enforced: every cacheKey includes orgId, and clearOrgCache()
 * removes all cached data for a specific org on org switch.
 *
 * Author: built_by_Beck
 */

import {
  getOfflineDb,
  type CachedExtinguisher,
  type CachedInspection,
  type CachedWorkspace,
  type CachedLocation,
} from '../lib/offlineDb.ts';

// ---------- Extinguisher caching ----------

/**
 * Cache a list of extinguishers for a given org.
 * Uses a transaction for batch writes.
 */
export async function cacheExtinguishersForWorkspace(
  orgId: string,
  extinguishers: Array<Record<string, unknown>>,
): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction('cachedExtinguishers', 'readwrite');
  const now = Date.now();

  for (const ext of extinguishers) {
    const extinguisherId = String(ext['id'] ?? ext['extinguisherId'] ?? '');
    if (!extinguisherId) continue;
    const record: CachedExtinguisher = {
      cacheKey: `${orgId}_${extinguisherId}`,
      orgId,
      extinguisherId,
      data: ext,
      cachedAt: now,
    };
    await tx.store.put(record);
  }

  await tx.done;
}

/**
 * Get a single cached extinguisher by extinguisherId.
 */
export async function getCachedExtinguisher(
  orgId: string,
  extinguisherId: string,
): Promise<Record<string, unknown> | null> {
  const db = await getOfflineDb();
  const record = await db.get('cachedExtinguishers', `${orgId}_${extinguisherId}`);
  return record?.data ?? null;
}

// ---------- Inspection caching ----------

/**
 * Cache a list of inspections for a workspace.
 */
export async function cacheInspectionsForWorkspace(
  orgId: string,
  workspaceId: string,
  inspections: Array<Record<string, unknown>>,
): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction('cachedInspections', 'readwrite');
  const now = Date.now();

  for (const insp of inspections) {
    const inspectionId = String(insp['id'] ?? insp['inspectionId'] ?? '');
    if (!inspectionId) continue;
    const record: CachedInspection = {
      cacheKey: `${orgId}_${inspectionId}`,
      orgId,
      inspectionId,
      workspaceId,
      data: insp,
      cachedAt: now,
    };
    await tx.store.put(record);
  }

  await tx.done;
}

/**
 * Get all cached inspections for a workspace.
 */
export async function getCachedInspectionsForWorkspace(
  orgId: string,
  workspaceId: string,
): Promise<Array<Record<string, unknown>>> {
  const db = await getOfflineDb();
  const records = await db.getAllFromIndex(
    'cachedInspections',
    'by-orgId-workspaceId',
    [orgId, workspaceId],
  );
  return records.map((r) => r.data);
}

// ---------- Workspace caching ----------

/**
 * Cache a single workspace.
 */
export async function cacheWorkspace(
  orgId: string,
  workspace: Record<string, unknown>,
): Promise<void> {
  const db = await getOfflineDb();
  const workspaceId = String(workspace['id'] ?? workspace['workspaceId'] ?? '');
  if (!workspaceId) return;

  const record: CachedWorkspace = {
    cacheKey: `${orgId}_${workspaceId}`,
    orgId,
    workspaceId,
    data: workspace,
    cachedAt: Date.now(),
  };
  await db.put('cachedWorkspaces', record);
}

/**
 * Get a cached workspace by workspaceId.
 */
export async function getCachedWorkspace(
  orgId: string,
  workspaceId: string,
): Promise<Record<string, unknown> | null> {
  const db = await getOfflineDb();
  const record = await db.get('cachedWorkspaces', `${orgId}_${workspaceId}`);
  return record?.data ?? null;
}

// ---------- Location caching ----------

/**
 * Cache a list of locations for a given org.
 */
export async function cacheLocations(
  orgId: string,
  locations: Array<Record<string, unknown>>,
): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction('cachedLocations', 'readwrite');
  const now = Date.now();

  for (const loc of locations) {
    const locationId = String(loc['id'] ?? loc['locationId'] ?? '');
    if (!locationId) continue;
    const record: CachedLocation = {
      cacheKey: `${orgId}_${locationId}`,
      orgId,
      locationId,
      data: loc,
      cachedAt: now,
    };
    await tx.store.put(record);
  }

  await tx.done;
}

// ---------- Org isolation ----------

/**
 * Clear ALL cached data for the given org from all cache stores.
 * Called on org switch to prevent cross-org contamination.
 */
export async function clearOrgCache(orgId: string): Promise<void> {
  const db = await getOfflineDb();

  // Clear from each cache store
  const stores = [
    'cachedExtinguishers',
    'cachedInspections',
    'cachedWorkspaces',
    'cachedLocations',
  ] as const;

  for (const storeName of stores) {
    const records = await db.getAllFromIndex(storeName, 'by-orgId', orgId);
    const tx = db.transaction(storeName, 'readwrite');
    for (const record of records) {
      await tx.store.delete(record.cacheKey);
    }
    await tx.done;
  }
}

// ---------- Sync metadata ----------

/**
 * Get the cache age in milliseconds for the given org.
 * Returns null if no sync metadata exists.
 */
export async function getCacheAge(orgId: string): Promise<number | null> {
  const db = await getOfflineDb();
  const meta = await db.get('syncMeta', `lastSync_${orgId}`);
  if (!meta) return null;
  const ts = meta.value as number;
  return Date.now() - ts;
}

/**
 * Update the last sync timestamp for the given org.
 */
export async function updateLastSyncTimestamp(orgId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.put('syncMeta', {
    key: `lastSync_${orgId}`,
    value: Date.now(),
  });
}
