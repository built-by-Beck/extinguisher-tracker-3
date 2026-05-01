import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { throwInvalidArgument } from '../utils/errors.js';

const PRESET_AVATAR_IDS = [
  'helmet-red',
  'shield-blue',
  'clipboard-green',
  'building-slate',
  'spark-amber',
  'hydrant-purple',
] as const;

type PresetAvatarId = typeof PRESET_AVATAR_IDS[number];

interface UpdateUserProfileInput {
  displayName: string;
  avatarId: PresetAvatarId;
}

interface UpdateUserProfileOutput {
  success: boolean;
}

function hasUnsafeTextCharacters(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 || char === '<' || char === '>';
  });
}

function normalizeDisplayName(value: unknown): string {
  if (typeof value !== 'string') {
    throwInvalidArgument('Display name is required.');
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) {
    throwInvalidArgument('Display name must be at least 2 characters.');
  }
  if (normalized.length > 80) {
    throwInvalidArgument('Display name must be 80 characters or less.');
  }
  if (hasUnsafeTextCharacters(normalized)) {
    throwInvalidArgument('Display name contains unsupported characters.');
  }

  return normalized;
}

function validateAvatarId(value: unknown): PresetAvatarId {
  if (typeof value !== 'string' || !PRESET_AVATAR_IDS.includes(value as PresetAvatarId)) {
    throwInvalidArgument('Choose one of the available profile avatars.');
  }
  return value as PresetAvatarId;
}

async function syncMemberDisplayNames(uid: string, displayName: string): Promise<void> {
  const memberSnap = await adminDb
    .collectionGroup('members')
    .where('uid', '==', uid)
    .get();

  if (memberSnap.empty) {
    return;
  }

  let batch = adminDb.batch();
  let batchCount = 0;
  const now = FieldValue.serverTimestamp();

  for (const memberDoc of memberSnap.docs) {
    if (memberDoc.data().status !== 'active') {
      continue;
    }

    batch.update(memberDoc.ref, {
      displayName,
      updatedAt: now,
    });
    batchCount += 1;

    if (batchCount === 450) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
}

export const updateUserProfile = onCall<UpdateUserProfileInput, Promise<UpdateUserProfileOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    const { uid } = validateAuth(request);
    const displayName = normalizeDisplayName(request.data.displayName);
    const avatarId = validateAvatarId(request.data.avatarId);
    const now = FieldValue.serverTimestamp();

    await adminAuth.updateUser(uid, {
      displayName,
      photoURL: null,
    });

    await adminDb.doc(`usr/${uid}`).set(
      {
        displayName,
        avatarId,
        photoURL: null,
        updatedAt: now,
      },
      { merge: true },
    );

    await syncMemberDisplayNames(uid, displayName);

    return { success: true };
  },
);
