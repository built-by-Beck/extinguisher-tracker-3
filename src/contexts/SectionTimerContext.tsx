import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth.ts';
import {
  addWorkTimeDuration,
  subscribeToUserWorkTimeForWorkspace,
  type WorkTimeDaily,
} from '../services/workTimeService.ts';
import {
  formatWorkTimeMs,
  getWorkDateLocal,
  IDLE_CHECK_INTERVAL_MS,
  IDLE_TIMEOUT_MS,
  makeActiveTimerKey,
  makeLegacyTimesKey,
  MAX_ACTIVE_SEGMENT_MS,
  MAX_DAILY_MS,
} from '../utils/workTimeUtils.ts';

export interface StartTimerParams {
  section: string;
  workspaceId: string;
  workspaceLabel: string;
  locationId?: string | null;
}

interface ActiveTimerState {
  section: string;
  workspaceId: string;
  workspaceLabel: string;
  locationId: string | null;
  startTime: number;
}

export interface SectionTimerContextValue {
  activeSection: string | null;
  activeWorkspaceId: string | null;
  activeWorkspaceLabel: string | null;
  idlePromptSection: string | null;
  currentElapsed: number;
  segmentCapReached: boolean;
  dailyCapReached: boolean;
  startTimer: (params: StartTimerParams) => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  confirmActive: () => void;
  dismissIdle: () => void;
  getTodayTime: (workspaceId: string, section: string) => number;
  getTotalTime: (workspaceId: string, section: string) => number;
  getLiveTodayTime: (workspaceId: string, section: string) => number;
  getLiveTotalTime: (workspaceId: string, section: string) => number;
  formatTime: (ms: number) => string;
  setTrackedWorkspaceId: (workspaceId: string | null) => void;
  clearSegmentCapFlag: () => void;
}

const SectionTimerContext = createContext<SectionTimerContextValue | null>(
  null,
);

function getSafeElapsed(
  startTime: number,
  maxElapsedMs = MAX_ACTIVE_SEGMENT_MS,
): number {
  return Math.max(0, Math.min(Date.now() - startTime, maxElapsedMs));
}

export function SectionTimerProvider({ children }: { children: ReactNode }) {
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';
  const userId = user?.uid ?? '';
  const userEmail = user?.email ?? '';

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const [activeWorkspaceLabel, setActiveWorkspaceLabel] = useState<
    string | null
  >(null);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(
    null,
  );
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [idlePromptSection, setIdlePromptSection] = useState<string | null>(
    null,
  );
  const [segmentCapReached, setSegmentCapReached] = useState(false);
  const [dailyCapReached, setDailyCapReached] = useState(false);
  const [trackedWorkspaceId, setTrackedWorkspaceId] = useState<string | null>(
    null,
  );
  const [workTimeRows, setWorkTimeRows] = useState<WorkTimeDaily[]>([]);

  const timerStartTimeRef = useRef<number | null>(null);
  const activeSectionRef = useRef<string | null>(null);
  const activeWorkspaceIdRef = useRef<string | null>(null);
  const activeWorkspaceLabelRef = useRef<string | null>(null);
  const activeLocationIdRef = useRef<string | null>(null);
  const lastConfirmedAtRef = useRef<number | null>(null);
  const workTimeRowsRef = useRef<WorkTimeDaily[]>([]);
  const migratedLegacyRef = useRef<Set<string>>(new Set());
  const idleWorkspaceRef = useRef<{
    workspaceId: string;
    workspaceLabel: string;
    locationId: string | null;
  } | null>(null);

  const activeKey =
    orgId && userId ? makeActiveTimerKey(orgId, userId) : '';

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    activeWorkspaceIdRef.current = activeWorkspaceId;
  }, [activeWorkspaceId]);

  useEffect(() => {
    activeWorkspaceLabelRef.current = activeWorkspaceLabel;
  }, [activeWorkspaceLabel]);

  useEffect(() => {
    activeLocationIdRef.current = activeLocationId;
  }, [activeLocationId]);

  useEffect(() => {
    workTimeRowsRef.current = workTimeRows;
  }, [workTimeRows]);

  const persistActiveState = useCallback(
    (state: ActiveTimerState | null) => {
      if (!activeKey) return;
      try {
        if (state) {
          localStorage.setItem(activeKey, JSON.stringify(state));
        } else {
          localStorage.removeItem(activeKey);
        }
      } catch {
        // ignore
      }
    },
    [activeKey],
  );

  const clearActiveTimer = useCallback(() => {
    timerStartTimeRef.current = null;
    lastConfirmedAtRef.current = null;
    setActiveSection(null);
    setActiveWorkspaceId(null);
    setActiveWorkspaceLabel(null);
    setActiveLocationId(null);
    activeSectionRef.current = null;
    activeWorkspaceIdRef.current = null;
    activeWorkspaceLabelRef.current = null;
    activeLocationIdRef.current = null;
    setCurrentElapsed(0);
    persistActiveState(null);
  }, [persistActiveState]);

  const persistElapsedToFirestore = useCallback(
    async (
      section: string,
      workspaceId: string,
      workspaceLabel: string,
      locationId: string | null,
      elapsedMs: number,
    ) => {
      if (!orgId || !userId || elapsedMs <= 0) return;

      try {
        await addWorkTimeDuration({
          orgId,
          userId,
          userEmail,
          workspaceId,
          workspaceLabel,
          section,
          locationId,
          durationMs: elapsedMs,
        });
      } catch {
        // offline or rules — best effort
      }
    },
    [orgId, userId, userEmail],
  );

  const migrateLegacyTimes = useCallback(
    async (workspaceId: string, workspaceLabel: string) => {
      if (!orgId || !userId) return;
      const migrationKey = `${orgId}_${workspaceId}`;
      if (migratedLegacyRef.current.has(migrationKey)) return;

      const legacyKey = makeLegacyTimesKey(orgId, workspaceId);
      try {
        const raw = localStorage.getItem(legacyKey);
        if (!raw) {
          migratedLegacyRef.current.add(migrationKey);
          return;
        }
        const parsed = JSON.parse(raw) as Record<string, number>;
        for (const [section, ms] of Object.entries(parsed)) {
          if (ms > 0) {
            await persistElapsedToFirestore(
              section,
              workspaceId,
              workspaceLabel,
              null,
              Math.min(ms, MAX_DAILY_MS),
            );
          }
        }
        localStorage.removeItem(legacyKey);
      } catch {
        // ignore
      }
      migratedLegacyRef.current.add(migrationKey);
    },
    [orgId, userId, persistElapsedToFirestore],
  );

  const accumulateAndPersist = useCallback(
    async (capMs?: number) => {
      const section = activeSectionRef.current;
      const workspaceId = activeWorkspaceIdRef.current;
      const workspaceLabel = activeWorkspaceLabelRef.current ?? '';
      const locationId = activeLocationIdRef.current;
      const start = timerStartTimeRef.current;

      if (!section || !workspaceId || start === null) return;

      let elapsed = getSafeElapsed(start);
      if (capMs !== undefined) {
        elapsed = Math.min(elapsed, capMs);
      }

      if (elapsed <= 0) return;

      const workDate = getWorkDateLocal();
      const existingToday = workTimeRowsRef.current
        .filter(
          (r) =>
            r.section === section &&
            r.workspaceId === workspaceId &&
            r.workDate === workDate &&
            r.userId === userId,
        )
        .reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

      const remainingDaily = Math.max(0, MAX_DAILY_MS - existingToday);
      const toPersist = Math.min(elapsed, remainingDaily);

      if (toPersist <= 0) {
        setDailyCapReached(true);
        return;
      }

      if (toPersist < elapsed) {
        setDailyCapReached(true);
      }

      await migrateLegacyTimes(workspaceId, workspaceLabel);
      await persistElapsedToFirestore(
        section,
        workspaceId,
        workspaceLabel,
        locationId,
        toPersist,
      );
    },
    [userId, migrateLegacyTimes, persistElapsedToFirestore],
  );

  // Restore active timer on mount
  useEffect(() => {
    if (!activeKey) {
      clearActiveTimer();
      return;
    }

    try {
      const saved = localStorage.getItem(activeKey);
      if (!saved) {
        clearActiveTimer();
        return;
      }

      const parsed = JSON.parse(saved) as ActiveTimerState;
      const elapsedSinceStart = getSafeElapsed(parsed.startTime);

      if (Date.now() - parsed.startTime >= IDLE_TIMEOUT_MS) {
        idleWorkspaceRef.current = {
          workspaceId: parsed.workspaceId,
          workspaceLabel: parsed.workspaceLabel,
          locationId: parsed.locationId,
        };
        void (async () => {
          activeSectionRef.current = parsed.section;
          activeWorkspaceIdRef.current = parsed.workspaceId;
          activeWorkspaceLabelRef.current = parsed.workspaceLabel;
          activeLocationIdRef.current = parsed.locationId;
          timerStartTimeRef.current = parsed.startTime;
          await accumulateAndPersist(
            Math.min(elapsedSinceStart, IDLE_TIMEOUT_MS),
          );
          clearActiveTimer();
          setIdlePromptSection(parsed.section);
        })();
        return;
      }

      if (elapsedSinceStart >= MAX_ACTIVE_SEGMENT_MS) {
        void (async () => {
          activeSectionRef.current = parsed.section;
          activeWorkspaceIdRef.current = parsed.workspaceId;
          activeWorkspaceLabelRef.current = parsed.workspaceLabel;
          activeLocationIdRef.current = parsed.locationId;
          timerStartTimeRef.current = parsed.startTime;
          await accumulateAndPersist(MAX_ACTIVE_SEGMENT_MS);
          clearActiveTimer();
          setSegmentCapReached(true);
        })();
        return;
      }

      setActiveSection(parsed.section);
      setActiveWorkspaceId(parsed.workspaceId);
      setActiveWorkspaceLabel(parsed.workspaceLabel);
      setActiveLocationId(parsed.locationId);
      timerStartTimeRef.current = parsed.startTime;
      lastConfirmedAtRef.current = parsed.startTime;
      setCurrentElapsed(elapsedSinceStart);
      setTrackedWorkspaceId(parsed.workspaceId);
    } catch {
      clearActiveTimer();
    }
  }, [activeKey, accumulateAndPersist, clearActiveTimer]);

  // Subscribe to user's work time for tracked workspace
  useEffect(() => {
    if (!orgId || !userId || !trackedWorkspaceId) {
      setWorkTimeRows([]);
      return;
    }
    return subscribeToUserWorkTimeForWorkspace(
      orgId,
      userId,
      trackedWorkspaceId,
      setWorkTimeRows,
    );
  }, [orgId, userId, trackedWorkspaceId]);

  // Tick elapsed every second
  useEffect(() => {
    if (!activeSection) {
      setCurrentElapsed(0);
      return;
    }

    const intervalId = setInterval(() => {
      const start = timerStartTimeRef.current;
      if (start === null) return;

      const elapsed = getSafeElapsed(start);
      setCurrentElapsed(elapsed);

      if (elapsed >= MAX_ACTIVE_SEGMENT_MS) {
        void (async () => {
          await accumulateAndPersist(MAX_ACTIVE_SEGMENT_MS);
          clearActiveTimer();
          setSegmentCapReached(true);
        })();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeSection, accumulateAndPersist, clearActiveTimer]);

  // Idle check
  useEffect(() => {
    if (!activeSection) return;

    const idleCheckId = setInterval(() => {
      const lastConfirmed = lastConfirmedAtRef.current;
      const section = activeSectionRef.current;
      if (
        lastConfirmed !== null &&
        section &&
        Date.now() - lastConfirmed >= IDLE_TIMEOUT_MS
      ) {
        idleWorkspaceRef.current = {
          workspaceId: activeWorkspaceIdRef.current ?? '',
          workspaceLabel: activeWorkspaceLabelRef.current ?? '',
          locationId: activeLocationIdRef.current,
        };
        void (async () => {
          const start = timerStartTimeRef.current;
          if (start !== null) {
            await accumulateAndPersist(
              Math.min(getSafeElapsed(start), IDLE_TIMEOUT_MS),
            );
          }
          clearActiveTimer();
          setIdlePromptSection(section);
        })();
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => clearInterval(idleCheckId);
  }, [activeSection, accumulateAndPersist, clearActiveTimer]);

  const startTimer = useCallback(
    (params: StartTimerParams) => {
      const { section, workspaceId, workspaceLabel, locationId = null } =
        params;

      if (
        activeSectionRef.current === section &&
        activeWorkspaceIdRef.current === workspaceId
      ) {
        return;
      }

      if (activeSectionRef.current) {
        void accumulateAndPersist();
      }

      const now = Date.now();
      timerStartTimeRef.current = now;
      lastConfirmedAtRef.current = now;
      setActiveSection(section);
      setActiveWorkspaceId(workspaceId);
      setActiveWorkspaceLabel(workspaceLabel);
      setActiveLocationId(locationId);
      activeSectionRef.current = section;
      activeWorkspaceIdRef.current = workspaceId;
      activeWorkspaceLabelRef.current = workspaceLabel;
      activeLocationIdRef.current = locationId;
      setCurrentElapsed(0);
      setIdlePromptSection(null);
      setSegmentCapReached(false);
      setDailyCapReached(false);
      setTrackedWorkspaceId(workspaceId);
      idleWorkspaceRef.current = {
        workspaceId,
        workspaceLabel,
        locationId,
      };

      persistActiveState({
        section,
        workspaceId,
        workspaceLabel,
        locationId,
        startTime: now,
      });
    },
    [accumulateAndPersist, persistActiveState],
  );

  const pauseTimer = useCallback(() => {
    void (async () => {
      await accumulateAndPersist();
      clearActiveTimer();
    })();
  }, [accumulateAndPersist, clearActiveTimer]);

  const stopTimer = useCallback(() => {
    void (async () => {
      await accumulateAndPersist();
      clearActiveTimer();
    })();
  }, [accumulateAndPersist, clearActiveTimer]);

  const confirmActive = useCallback(() => {
    const section = idlePromptSection;
    const idleWs = idleWorkspaceRef.current;
    if (!section || !idleWs?.workspaceId) {
      setIdlePromptSection(null);
      return;
    }

    const now = Date.now();
    timerStartTimeRef.current = now;
    lastConfirmedAtRef.current = now;
    setActiveSection(section);
    setActiveWorkspaceId(idleWs.workspaceId);
    setActiveWorkspaceLabel(idleWs.workspaceLabel);
    setActiveLocationId(idleWs.locationId);
    activeSectionRef.current = section;
    activeWorkspaceIdRef.current = idleWs.workspaceId;
    activeWorkspaceLabelRef.current = idleWs.workspaceLabel;
    activeLocationIdRef.current = idleWs.locationId;
    setCurrentElapsed(0);
    setIdlePromptSection(null);
    setTrackedWorkspaceId(idleWs.workspaceId);

    persistActiveState({
      section,
      workspaceId: idleWs.workspaceId,
      workspaceLabel: idleWs.workspaceLabel,
      locationId: idleWs.locationId,
      startTime: now,
    });
  }, [idlePromptSection, persistActiveState]);

  const dismissIdle = useCallback(() => {
    lastConfirmedAtRef.current = null;
    setIdlePromptSection(null);
    idleWorkspaceRef.current = null;
  }, []);

  const getTodayTime = useCallback(
    (workspaceId: string, section: string): number => {
      const workDate = getWorkDateLocal();
      return workTimeRowsRef.current
        .filter(
          (r) =>
            r.workspaceId === workspaceId &&
            r.section === section &&
            r.workDate === workDate,
        )
        .reduce((sum, r) => sum + (r.durationMs ?? 0), 0);
    },
    [],
  );

  const getTotalTime = useCallback(
    (workspaceId: string, section: string): number => {
      return workTimeRowsRef.current
        .filter((r) => r.workspaceId === workspaceId && r.section === section)
        .reduce((sum, r) => sum + (r.durationMs ?? 0), 0);
    },
    [],
  );

  const getLiveTodayTime = useCallback(
    (workspaceId: string, section: string): number => {
      const base = getTodayTime(workspaceId, section);
      if (
        activeSectionRef.current === section &&
        activeWorkspaceIdRef.current === workspaceId &&
        timerStartTimeRef.current !== null
      ) {
        return base + currentElapsed;
      }
      return base;
    },
    [getTodayTime, currentElapsed],
  );

  const getLiveTotalTime = useCallback(
    (workspaceId: string, section: string): number => {
      const base = getTotalTime(workspaceId, section);
      if (
        activeSectionRef.current === section &&
        activeWorkspaceIdRef.current === workspaceId &&
        timerStartTimeRef.current !== null
      ) {
        return base + currentElapsed;
      }
      return base;
    },
    [getTotalTime, currentElapsed],
  );

  const formatTime = useCallback((ms: number) => formatWorkTimeMs(ms), []);

  const clearSegmentCapFlag = useCallback(() => {
    setSegmentCapReached(false);
    setDailyCapReached(false);
  }, []);

  const value: SectionTimerContextValue = {
    activeSection,
    activeWorkspaceId,
    activeWorkspaceLabel,
    idlePromptSection,
    currentElapsed,
    segmentCapReached,
    dailyCapReached,
    startTimer,
    pauseTimer,
    stopTimer,
    confirmActive,
    dismissIdle,
    getTodayTime,
    getTotalTime,
    getLiveTodayTime,
    getLiveTotalTime,
    formatTime,
    setTrackedWorkspaceId,
    clearSegmentCapFlag,
  };

  return (
    <SectionTimerContext.Provider value={value}>
      {children}
    </SectionTimerContext.Provider>
  );
}

export function useSectionTimerContext(): SectionTimerContextValue {
  const ctx = useContext(SectionTimerContext);
  if (!ctx) {
    throw new Error(
      'useSectionTimerContext must be used within SectionTimerProvider',
    );
  }
  return ctx;
}

/** Convenience hook scoped to a workspace for timer display in inspection views. */
export function useWorkspaceSectionTimer(
  workspaceId: string,
  workspaceLabel: string,
) {
  const ctx = useSectionTimerContext();

  useEffect(() => {
    if (workspaceId) {
      ctx.setTrackedWorkspaceId(workspaceId);
    }
  }, [workspaceId, ctx]);

  const startForSection = useCallback(
    (section: string, locationId?: string | null) => {
      ctx.startTimer({
        section,
        workspaceId,
        workspaceLabel,
        locationId,
      });
    },
    [ctx, workspaceId, workspaceLabel],
  );

  const isActiveForSection = useCallback(
    (section: string) =>
      ctx.activeSection === section && ctx.activeWorkspaceId === workspaceId,
    [ctx.activeSection, ctx.activeWorkspaceId, workspaceId],
  );

  return {
    ...ctx,
    startForSection,
    isActiveForSection,
    getTodayTime: (section: string) => ctx.getTodayTime(workspaceId, section),
    getLiveTodayTime: (section: string) =>
      ctx.getLiveTodayTime(workspaceId, section),
    getTotalTime: (section: string) => ctx.getTotalTime(workspaceId, section),
    getLiveTotalTime: (section: string) =>
      ctx.getLiveTotalTime(workspaceId, section),
  };
}
