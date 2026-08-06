/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, it, expect } from '@jest/globals';
import {
  hashToken,
  isInviteExpired,
  inviteRetentionCutoff,
  partitionPendingInvitesByExpiry,
  INVITE_EXPIRY_DAYS,
  INVITE_RETENTION_DAYS,
} from '../invites/inviteHelpers.js';

describe('inviteHelpers', () => {
  describe('hashToken', () => {
    it('returns a stable sha256 hex digest', () => {
      const a = hashToken('abc');
      const b = hashToken('abc');
      expect(a).toBe(b);
      expect(a).toHaveLength(64);
      expect(hashToken('other')).not.toBe(a);
    });
  });

  describe('isInviteExpired', () => {
    it('returns false when expiresAt is in the future', () => {
      const now = new Date('2026-07-21T12:00:00Z');
      const expiresAt = new Date('2026-07-28T12:00:00Z');
      expect(isInviteExpired(expiresAt, now)).toBe(false);
    });

    it('returns true when expiresAt is in the past', () => {
      const now = new Date('2026-07-21T12:00:00Z');
      const expiresAt = new Date('2026-07-14T12:00:00Z');
      expect(isInviteExpired(expiresAt, now)).toBe(true);
    });

    it('returns false for missing expiresAt', () => {
      expect(isInviteExpired(null)).toBe(false);
      expect(isInviteExpired(undefined)).toBe(false);
    });

    it('supports Timestamp-like toDate()', () => {
      const now = new Date('2026-07-21T12:00:00Z');
      const ts = { toDate: () => new Date('2026-07-01T00:00:00Z') };
      expect(isInviteExpired(ts, now)).toBe(true);
    });
  });

  describe('inviteRetentionCutoff', () => {
    it('subtracts INVITE_RETENTION_DAYS by default', () => {
      const now = new Date('2026-07-21T00:00:00Z');
      const cutoff = inviteRetentionCutoff(now);
      const expected = new Date(now.getTime());
      expected.setDate(expected.getDate() - INVITE_RETENTION_DAYS);
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });
  });

  describe('partitionPendingInvitesByExpiry', () => {
    it('separates expired pending docs from still-valid ones', () => {
      const now = new Date('2026-07-21T12:00:00Z');
      const docs = [
        {
          id: 'expired',
          data: () => ({ expiresAt: new Date('2026-07-01T00:00:00Z') }),
        },
        {
          id: 'active',
          data: () => ({ expiresAt: new Date('2026-07-28T00:00:00Z') }),
        },
      ];

      const { expired, active } = partitionPendingInvitesByExpiry(docs, now);
      expect(expired).toHaveLength(1);
      expect(expired[0].id).toBe('expired');
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');
    });

    it('treats expired pending as non-blocking (active empty)', () => {
      const now = new Date('2026-07-21T12:00:00Z');
      const docs = [
        {
          id: 'stale',
          data: () => ({ expiresAt: new Date('2026-06-01T00:00:00Z') }),
        },
      ];
      const { expired, active } = partitionPendingInvitesByExpiry(docs, now);
      expect(expired).toHaveLength(1);
      expect(active).toHaveLength(0);
    });
  });

  describe('constants', () => {
    it('uses 7-day expiry and 30-day retention', () => {
      expect(INVITE_EXPIRY_DAYS).toBe(7);
      expect(INVITE_RETENTION_DAYS).toBe(30);
    });
  });
});
