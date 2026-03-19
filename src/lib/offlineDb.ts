/**
 * IndexedDB schema and database utility for EX3 offline sync.
 *
 * Database: 'ex3-offline', version 1
 * Stores:
 *   - inspectionQueue: write queue for offline inspection saves
 *   - cachedExtinguishers: local cache of extinguisher data
 *   - cachedInspections: local cache of inspection data
 *   - cachedWorkspaces: local cache of workspace data
 *   - cachedLocations: local cache of location data
 *   - syncMeta: metadata (lastSyncTimestamp, etc.)
 *
 * Author: built_by_Beck
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { ChecklistData } from '../services/inspectionService.ts';

// ---------- Record type interfaces ----------

export interface QueuedInspection {
  queueId: string;
  orgId: string;
  inspectionId: string;
  extinguisherId: string;
  workspaceId: string;
  status: 'pass' | 'fail';
  checklistData: ChecklistData;
  notes: string;
  attestation: {
    confirmed: boolean;
    text: string;
    inspectorName: string;
  } | null;
  queuedAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  error: string | null;
  syncStatus: 'pending' | 'syncing' | 'failed' | 'synced' | 'conflict';
  conflictReason?: string;
}

export interface CachedExtinguisher {
  cacheKey: string; // `${orgId}_${extinguisherId}`
  orgId: string;
  extinguisherId: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

export interface CachedInspection {
  cacheKey: string; // `${orgId}_${inspectionId}`
  orgId: string;
  inspectionId: string;
  workspaceId: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

export interface CachedWorkspace {
  cacheKey: string; // `${orgId}_${workspaceId}`
  orgId: string;
  workspaceId: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

export interface CachedLocation {
  cacheKey: string; // `${orgId}_${locationId}`
  orgId: string;
  locationId: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

export interface SyncMeta {
  key: string;
  value: unknown;
}

// ---------- Database schema definition ----------

interface Ex3OfflineSchema {
  inspectionQueue: {
    key: string;
    value: QueuedInspection;
    indexes: {
      'by-orgId': string;
      'by-inspectionId': string;
      'by-queuedAt': number;
    };
  };
  cachedExtinguishers: {
    key: string;
    value: CachedExtinguisher;
    indexes: {
      'by-orgId': string;
    };
  };
  cachedInspections: {
    key: string;
    value: CachedInspection;
    indexes: {
      'by-orgId': string;
      'by-orgId-workspaceId': [string, string];
    };
  };
  cachedWorkspaces: {
    key: string;
    value: CachedWorkspace;
    indexes: {
      'by-orgId': string;
    };
  };
  cachedLocations: {
    key: string;
    value: CachedLocation;
    indexes: {
      'by-orgId': string;
    };
  };
  syncMeta: {
    key: string;
    value: SyncMeta;
    indexes: Record<string, never>;
  };
}

// ---------- Singleton DB instance ----------

let dbPromise: Promise<IDBPDatabase<Ex3OfflineSchema>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<Ex3OfflineSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<Ex3OfflineSchema>('ex3-offline', 1, {
      upgrade(db) {
        // inspectionQueue store
        const queueStore = db.createObjectStore('inspectionQueue', {
          keyPath: 'queueId',
        });
        queueStore.createIndex('by-orgId', 'orgId');
        queueStore.createIndex('by-inspectionId', 'inspectionId');
        queueStore.createIndex('by-queuedAt', 'queuedAt');

        // cachedExtinguishers store
        const extStore = db.createObjectStore('cachedExtinguishers', {
          keyPath: 'cacheKey',
        });
        extStore.createIndex('by-orgId', 'orgId');

        // cachedInspections store
        const inspStore = db.createObjectStore('cachedInspections', {
          keyPath: 'cacheKey',
        });
        inspStore.createIndex('by-orgId', 'orgId');
        inspStore.createIndex('by-orgId-workspaceId', ['orgId', 'workspaceId']);

        // cachedWorkspaces store
        const wsStore = db.createObjectStore('cachedWorkspaces', {
          keyPath: 'cacheKey',
        });
        wsStore.createIndex('by-orgId', 'orgId');

        // cachedLocations store
        const locStore = db.createObjectStore('cachedLocations', {
          keyPath: 'cacheKey',
        });
        locStore.createIndex('by-orgId', 'orgId');

        // syncMeta store
        db.createObjectStore('syncMeta', {
          keyPath: 'key',
        });
      },
    });
  }
  return dbPromise;
}
