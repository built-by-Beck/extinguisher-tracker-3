/**
 * expireInvitesJob — Scheduled Cloud Function
 * Marks overdue pending invites as expired, then hard-deletes terminal
 * invite docs past the retention window.
 *
 * Author: built_by_Beck
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { adminDb } from '../utils/admin.js';
import {
  INVITE_RETENTION_DAYS,
  deleteInviteDocs,
  inviteRetentionCutoff,
  markInvitesExpired,
} from './inviteHelpers.js';

export const expireInvitesJob = onSchedule(
  { schedule: 'every 24 hours', timeoutSeconds: 300 },
  async () => {
    const now = Timestamp.now();
    const retentionCutoff = Timestamp.fromDate(inviteRetentionCutoff());

    // 1. Mark overdue pending invites as expired
    const overduePendingSnap = await adminDb
      .collection('invite')
      .where('status', '==', 'pending')
      .where('expiresAt', '<', now)
      .limit(500)
      .get();

    const expiredCount = await markInvitesExpired(overduePendingSnap.docs);
    if (expiredCount > 0) {
      logger.info(`Marked ${expiredCount} pending invites as expired`);
    }

    // 2. Hard-delete terminal invites past retention (expiresAt + RETENTION_DAYS)
    //    expiresAt is always set at create time, so it is a stable retention anchor.
    let deletedTotal = 0;
    for (const status of ['expired', 'revoked', 'accepted'] as const) {
      const staleSnap = await adminDb
        .collection('invite')
        .where('status', '==', status)
        .where('expiresAt', '<', retentionCutoff)
        .limit(500)
        .get();

      const deleted = await deleteInviteDocs(staleSnap.docs);
      deletedTotal += deleted;
    }

    if (deletedTotal > 0) {
      logger.info(
        `Deleted ${deletedTotal} terminal invites older than ${INVITE_RETENTION_DAYS} days past expiresAt`,
      );
    }
  },
);
