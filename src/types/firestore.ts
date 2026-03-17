import type { Timestamp } from 'firebase/firestore';

/**
 * Adds `id: string` to any Firestore document type.
 * Use when reading documents from Firestore to attach the doc ID.
 */
export type WithId<T> = T & { id: string };

/**
 * Standard Firestore timestamp fields shared across many documents.
 */
export interface Timestamps {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
