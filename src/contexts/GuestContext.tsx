/**
 * GuestContext — manages anonymous guest sessions for read-only org access.
 * Used by guest routes only; completely independent of AuthContext/OrgContext.
 *
 * Author: built_by_Beck
 */

import {
  createContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase.ts';
import { activateGuestSessionCall } from '../services/guestService.ts';
import type { Organization } from '../types/organization.ts';
import type { OrgMember } from '../types/member.ts';

export interface GuestContextValue {
  isGuest: boolean;
  guestOrg: Organization | null;
  guestMember: OrgMember | null;
  guestOrgId: string | null;
  expiresAt: Date | null;
  loading: boolean;
  error: string | null;
  activateWithToken: (orgId: string, token: string) => Promise<void>;
  activateWithCode: (shareCode: string) => Promise<void>;
  resumeSession: (orgId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const GuestContext = createContext<GuestContextValue | null>(null);

interface GuestProviderProps {
  children: ReactNode;
}

export function GuestProvider({ children }: GuestProviderProps) {
  const [isGuest, setIsGuest] = useState(false);
  const [guestOrg, setGuestOrg] = useState<Organization | null>(null);
  const [guestMember, setGuestMember] = useState<OrgMember | null>(null);
  const [guestOrgId, setGuestOrgId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unsubOrgRef = useRef<(() => void) | null>(null);
  const unsubMemberRef = useRef<(() => void) | null>(null);

  /**
   * Set up real-time subscriptions to org and member docs after activation.
   */
  function subscribeToGuestData(orgId: string, anonUid: string, expires: Date) {
    // Cleanup any existing listeners
    if (unsubOrgRef.current) {
      unsubOrgRef.current();
      unsubOrgRef.current = null;
    }
    if (unsubMemberRef.current) {
      unsubMemberRef.current();
      unsubMemberRef.current = null;
    }

    setGuestOrgId(orgId);
    setExpiresAt(expires);

    // Subscribe to org doc
    const orgRef = doc(db, 'org', orgId);
    unsubOrgRef.current = onSnapshot(
      orgRef,
      (snap) => {
        if (snap.exists()) {
          setGuestOrg(snap.data() as Organization);
        } else {
          setGuestOrg(null);
        }
      },
      () => {
        // Silently fail on error — guest may have limited access
      },
    );

    // Subscribe to guest member doc
    const memberRef = doc(db, 'org', orgId, 'members', anonUid);
    unsubMemberRef.current = onSnapshot(
      memberRef,
      (snap) => {
        if (snap.exists()) {
          const member = snap.data() as OrgMember;
          setGuestMember(member);

          // Check expiration from member doc
          if (member.expiresAt) {
            const expiry = (member.expiresAt as unknown as { toDate: () => Date }).toDate();
            if (expiry <= new Date()) {
              // Session expired — sign out
              void handleSignOut();
            }
          }
        } else {
          // Member doc deleted (e.g., guest access disabled) — sign out
          void handleSignOut();
        }
      },
      () => {
        // Silently fail
      },
    );
  }

  const activateWithToken = useCallback(async (orgId: string, token: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Sign in anonymously
      const credential = await signInAnonymously(auth);
      const anonUid = credential.user.uid;

      // Activate guest session via Cloud Function
      const result = await activateGuestSessionCall({ orgId, token });

      const expires = new Date(result.expiresAt);
      subscribeToGuestData(orgId, anonUid, expires);
      setIsGuest(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to activate guest session.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activateWithCode = useCallback(async (shareCode: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Sign in anonymously
      const credential = await signInAnonymously(auth);
      const anonUid = credential.user.uid;

      // Activate guest session via Cloud Function
      const result = await activateGuestSessionCall({ shareCode });

      const expires = new Date(result.expiresAt);
      subscribeToGuestData(result.orgId, anonUid, expires);
      setIsGuest(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to activate guest session.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Resume an existing guest session for code-path guests.
   * The anonymous user + member doc already exist (created by GuestCodeEntry).
   * This reads the member doc to confirm it exists, then subscribes.
   */
  const resumeSession = useCallback(async (orgId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.isAnonymous) {
        throw new Error('No anonymous session found. Please use a share code or link.');
      }

      const anonUid = currentUser.uid;

      // Read the member doc to confirm it exists
      const memberRef = doc(db, 'org', orgId, 'members', anonUid);
      const memberSnap = await getDoc(memberRef);

      if (!memberSnap.exists()) {
        throw new Error('Guest session not found. The session may have expired.');
      }

      const memberData = memberSnap.data() as OrgMember;
      const expiresTimestamp = memberData.expiresAt;
      let expires: Date;
      if (expiresTimestamp && typeof (expiresTimestamp as unknown as { toDate: () => Date }).toDate === 'function') {
        expires = (expiresTimestamp as unknown as { toDate: () => Date }).toDate();
      } else {
        expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // fallback: 24h
      }

      if (expires <= new Date()) {
        throw new Error('Guest session has expired.');
      }

      subscribeToGuestData(orgId, anonUid, expires);
      setIsGuest(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resume guest session.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut(): Promise<void> {
    // Cleanup listeners
    if (unsubOrgRef.current) {
      unsubOrgRef.current();
      unsubOrgRef.current = null;
    }
    if (unsubMemberRef.current) {
      unsubMemberRef.current();
      unsubMemberRef.current = null;
    }

    // Clear state
    setIsGuest(false);
    setGuestOrg(null);
    setGuestMember(null);
    setGuestOrgId(null);
    setExpiresAt(null);
    setError(null);

    // Sign out of Firebase
    await firebaseSignOut(auth);
  }

  const signOut = useCallback(handleSignOut, []);

  const value: GuestContextValue = {
    isGuest,
    guestOrg,
    guestMember,
    guestOrgId,
    expiresAt,
    loading,
    error,
    activateWithToken,
    activateWithCode,
    resumeSession,
    signOut,
  };

  return (
    <GuestContext.Provider value={value}>
      {children}
    </GuestContext.Provider>
  );
}
