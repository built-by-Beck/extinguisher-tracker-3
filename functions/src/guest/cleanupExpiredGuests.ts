/**
 * cleanupExpiredGuestsJob — Scheduled Cloud Function
 * Runs every hour to delete expired guest member docs
 * and auto-disable expired guest access on org docs.
 *
 * Author: built_by_Beck
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { adminDb } from '../utils/admin.js';

export const cleanupExpiredGuestsJob = onSchedule(
  { schedule: 'every 1 hours', timeoutSeconds: 120 },
  async () => {
    const now = Timestamp.now();

    // 1. Delete expired guest member docs across all orgs
    const expiredMembersSnap = await adminDb
      .collectionGroup('members')
      .where('role', '==', 'guest')
      .where('expiresAt', '<', now)
      .get();

    if (!expiredMembersSnap.empty) {
      // Batch deletes in groups of 500 (Firestore batch limit)
      const docs = expiredMembersSnap.docs;
      let deleted = 0;

      for (let i = 0; i < docs.length; i += 500) {
        const chunk = docs.slice(i, i + 500);
        const batch = adminDb.batch();
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += chunk.length;
      }

      logger.info(`Cleaned up ${deleted} expired guest members`);
    }

    // 2. Auto-disable org docs where guestAccess has expired
    const expiredOrgsSnap = await adminDb
      .collection('org')
      .where('guestAccess.enabled', '==', true)
      .where('guestAccess.expiresAt', '<', now)
      .get();

    if (!expiredOrgsSnap.empty) {
      const orgDocs = expiredOrgsSnap.docs;
      for (let i = 0; i < orgDocs.length; i += 500) {
        const chunk = orgDocs.slice(i, i + 500);
        const orgBatch = adminDb.batch();
        chunk.forEach((orgDoc) => {
          orgBatch.update(orgDoc.ref, { guestAccess: null });
        });
        await orgBatch.commit();
      }

      logger.info(`Auto-disabled guest access on ${expiredOrgsSnap.size} expired orgs`);
    }
  },
);
