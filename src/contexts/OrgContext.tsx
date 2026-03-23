import {
  createContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  doc,
  collection,
  collectionGroup,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import type { Organization, OrgMember, OrgRole } from '../types/index.ts';
import { clearOrgCache } from '../services/offlineCacheService.ts';
import { clearOrgQueue, getPendingCount, processQueue } from '../services/offlineSyncService.ts';

interface UserOrgEntry {
  orgId: string;
  role: OrgRole;
}

export interface OrgContextValue {
  org: Organization | null;
  membership: OrgMember | null;
  orgLoading: boolean;
  switchOrg: (orgId: string) => Promise<void>;
  userOrgs: UserOrgEntry[];
  userOrgsLoading: boolean;
  hasRole: (roles: OrgRole[]) => boolean;
}

export const OrgContext = createContext<OrgContextValue | null>(null);

interface OrgProviderProps {
  children: ReactNode;
}

export function OrgProvider({ children }: OrgProviderProps) {
  const { user, userProfile, loading: authLoading } = useAuth();

  const [org, setOrg] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrgMember | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [userOrgs, setUserOrgs] = useState<UserOrgEntry[]>([]);
  const [userOrgsLoading, setUserOrgsLoading] = useState(true);

  // Track active org ID from user profile
  const activeOrgId = userProfile?.activeOrgId ?? null;

  // Refs to hold unsubscribe functions for cleanup
  const unsubOrgRef = useRef<(() => void) | null>(null);
  const unsubMemberRef = useRef<(() => void) | null>(null);

  // Listen to all orgs the user is a member of (collectionGroup query on "members")
  useEffect(() => {
    if (authLoading || !user) {
      setUserOrgs([]);
      setUserOrgsLoading(false);
      return;
    }

    setUserOrgsLoading(true);
    const membersQuery = query(
      collectionGroup(db, 'members'),
      where('uid', '==', user.uid),
      where('status', '==', 'active'),
    );

    const unsub = onSnapshot(
      membersQuery,
      (snapshot) => {
        const orgs: UserOrgEntry[] = [];
        snapshot.forEach((memberDoc) => {
          // The parent path is org/{orgId}/members
          const orgId = memberDoc.ref.parent.parent?.id;
          if (orgId) {
            const data = memberDoc.data() as OrgMember;
            orgs.push({ orgId, role: data.role });
          }
        });
        setUserOrgs(orgs);
        setUserOrgsLoading(false);
      },
      (err) => {
        console.error('[OrgContext] Failed to query user org memberships:', err);
        setUserOrgs([]);
        setUserOrgsLoading(false);
      },
    );

    return () => unsub();
  }, [authLoading, user]);

  // Auto-select first available org when activeOrgId is missing but user has memberships
  const autoSelectingRef = useRef(false);
  useEffect(() => {
    if (authLoading || !user || activeOrgId || userOrgsLoading || userOrgs.length === 0 || autoSelectingRef.current) {
      return;
    }
    // User is authenticated with org memberships but no activeOrgId — auto-select
    autoSelectingRef.current = true;
    const firstOrgId = userOrgs[0].orgId;
    const userDocRef = doc(db, 'usr', user.uid);
    updateDoc(userDocRef, {
      activeOrgId: firstOrgId,
      updatedAt: serverTimestamp(),
    })
      .catch((err) => {
        console.error('Failed to auto-select org:', err);
      })
      .finally(() => {
        autoSelectingRef.current = false;
      });
  }, [authLoading, user, activeOrgId, userOrgsLoading, userOrgs]);

  // Listen to active org document and membership document
  useEffect(() => {
    // Clean up previous listeners
    if (unsubOrgRef.current) {
      unsubOrgRef.current();
      unsubOrgRef.current = null;
    }
    if (unsubMemberRef.current) {
      unsubMemberRef.current();
      unsubMemberRef.current = null;
    }

    if (authLoading || userOrgsLoading) {
      return;
    }

    if (!user || !activeOrgId) {
      setOrg(null);
      setMembership(null);
      // Only mark loading as done if there are no orgs to auto-select
      if (userOrgs.length === 0) {
        setOrgLoading(false);
      }
      return;
    }

    setOrgLoading(true);
    let orgLoaded = false;
    let memberLoaded = false;

    function checkBothLoaded() {
      if (orgLoaded && memberLoaded) {
        setOrgLoading(false);
      }
    }

    // Listen to org/{activeOrgId}
    const orgDocRef = doc(db, 'org', activeOrgId);
    unsubOrgRef.current = onSnapshot(
      orgDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setOrg(snapshot.data() as Organization);
        } else {
          console.warn(`[OrgContext] Org document org/${activeOrgId} does not exist.`);
          setOrg(null);
        }
        orgLoaded = true;
        checkBothLoaded();
      },
      (err) => {
        console.error(`[OrgContext] Failed to listen to org/${activeOrgId}:`, err);
        setOrg(null);
        orgLoaded = true;
        checkBothLoaded();
      },
    );

    // Listen to org/{activeOrgId}/members/{uid}
    const memberDocRef = doc(collection(doc(db, 'org', activeOrgId), 'members'), user.uid);
    unsubMemberRef.current = onSnapshot(
      memberDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setMembership(snapshot.data() as OrgMember);
        } else {
          console.warn(`[OrgContext] Membership doc for user ${user.uid} in org/${activeOrgId} does not exist.`);
          setMembership(null);
        }
        memberLoaded = true;
        checkBothLoaded();
      },
      (err) => {
        console.error(`[OrgContext] Failed to listen to membership in org/${activeOrgId}:`, err);
        setMembership(null);
        memberLoaded = true;
        checkBothLoaded();
      },
    );

    return () => {
      if (unsubOrgRef.current) {
        unsubOrgRef.current();
        unsubOrgRef.current = null;
      }
      if (unsubMemberRef.current) {
        unsubMemberRef.current();
        unsubMemberRef.current = null;
      }
    };
  }, [authLoading, user, activeOrgId, userOrgsLoading, userOrgs.length]);

  const switchOrg = useCallback(
    async (orgId: string): Promise<void> => {
      if (!user) return;

      const currentOrgId = activeOrgId;

      // Org isolation: handle pending queue before switching away
      if (currentOrgId && currentOrgId !== orgId) {
        const pending = await getPendingCount(currentOrgId);
        if (pending > 0) {
          // Check if we're online by trying to process the queue
          try {
            await processQueue(currentOrgId);
          } catch {
            // processQueue failed — check if any remain
          }
          const stillPending = await getPendingCount(currentOrgId);
          if (stillPending > 0) {
            throw new Error(
              `You have ${stillPending} unsynced inspection${stillPending !== 1 ? 's' : ''}. Please sync before switching organizations.`,
            );
          }
        }

        // Clear cached data for the org being left
        await clearOrgCache(currentOrgId).catch(() => undefined);
        await clearOrgQueue(currentOrgId).catch(() => undefined);
      }

      const userDocRef = doc(db, 'usr', user.uid);
      await updateDoc(userDocRef, {
        activeOrgId: orgId,
        updatedAt: serverTimestamp(),
      });
      // The onSnapshot listener on the user profile in AuthContext
      // will pick up the change and trigger re-renders via activeOrgId
    },
    [user, activeOrgId],
  );

  const hasRole = useCallback(
    (roles: OrgRole[]): boolean => {
      if (!membership) return false;
      return roles.includes(membership.role);
    },
    [membership],
  );

  const value: OrgContextValue = {
    org,
    membership,
    orgLoading,
    switchOrg,
    userOrgs,
    userOrgsLoading,
    hasRole,
  };

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  );
}
