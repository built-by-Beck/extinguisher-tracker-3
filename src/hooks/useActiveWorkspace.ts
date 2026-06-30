import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { Workspace } from '../services/workspaceService.ts';

export function useActiveWorkspace(orgId: string) {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(
    null,
  );

  useEffect(() => {
    if (!orgId) {
      setActiveWorkspace(null);
      return;
    }

    const q = query(
      collection(db, 'org', orgId, 'workspaces'),
      where('status', '==', 'active'),
    );

    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setActiveWorkspace(null);
          return;
        }
        const latest = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Workspace)
          .sort((a, b) =>
            (b.monthYear ?? '').localeCompare(a.monthYear ?? ''),
          )[0];
        setActiveWorkspace(latest ?? null);
      },
      () => setActiveWorkspace(null),
    );
  }, [orgId]);

  return activeWorkspace;
}
