import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSectionTimerReturn {
  /** Which section is currently being timed (null = none) */
  activeSection: string | null;
  /** Start/resume timing for a section */
  startTimer: (section: string) => void;
  /** Pause the active timer (accumulates elapsed time) */
  pauseTimer: () => void;
  /** Stop the active timer (accumulates and clears active) */
  stopTimer: () => void;
  /** Get total accumulated ms for a section (including live elapsed) */
  getTotalTime: (section: string) => number;
  /** Get all section times (snapshot, not including live elapsed) */
  getAllTimes: () => Record<string, number>;
  /** Clear time for one section */
  clearSectionTime: (section: string) => void;
  /** Clear all section times */
  clearAllTimes: () => void;
  /** Format ms to "Xh Ym Zs" string */
  formatTime: (ms: number) => string;
}

function makeStorageKey(orgId: string, workspaceId: string): string {
  return `sectionTimes_${orgId}_${workspaceId}`;
}

function makeActiveKey(orgId: string, workspaceId: string): string {
  return `sectionTimerActive_${orgId}_${workspaceId}`;
}

interface ActiveTimerState {
  section: string;
  startTime: number; // Date.now() when started
}

/**
 * Custom hook for managing per-section timers with localStorage persistence.
 * Timer state survives page refreshes for field work reliability.
 */
export function useSectionTimer(orgId: string, workspaceId: string): UseSectionTimerReturn {
  const [sectionTimes, setSectionTimes] = useState<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [currentElapsed, setCurrentElapsed] = useState(0);

  // Refs to avoid stale closures in interval callback
  const timerStartTimeRef = useRef<number | null>(null);
  const activeSectionRef = useRef<string | null>(null);
  const sectionTimesRef = useRef<Record<string, number>>({});

  // Keep refs in sync with state via effect (not during render)
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    sectionTimesRef.current = sectionTimes;
  }, [sectionTimes]);

  const storageKey = makeStorageKey(orgId, workspaceId);
  const activeKey = makeActiveKey(orgId, workspaceId);

  // Load from localStorage on mount / when orgId or workspaceId changes
  useEffect(() => {
    if (!orgId || !workspaceId) {
      setSectionTimes({});
      setActiveSection(null);
      setCurrentElapsed(0);
      timerStartTimeRef.current = null;
      return;
    }

    try {
      const savedTimes = localStorage.getItem(storageKey);
      if (savedTimes) {
        const parsed = JSON.parse(savedTimes) as Record<string, number>;
        setSectionTimes(parsed);
        sectionTimesRef.current = parsed;
      } else {
        setSectionTimes({});
        sectionTimesRef.current = {};
      }

      // Restore active timer if one was running
      const savedActive = localStorage.getItem(activeKey);
      if (savedActive) {
        const parsed = JSON.parse(savedActive) as ActiveTimerState;
        setActiveSection(parsed.section);
        activeSectionRef.current = parsed.section;
        timerStartTimeRef.current = parsed.startTime;
        setCurrentElapsed(Date.now() - parsed.startTime);
      } else {
        setActiveSection(null);
        activeSectionRef.current = null;
        timerStartTimeRef.current = null;
        setCurrentElapsed(0);
      }
    } catch {
      // localStorage may be unavailable or corrupt — start fresh
      setSectionTimes({});
      setActiveSection(null);
      setCurrentElapsed(0);
      timerStartTimeRef.current = null;
    }
  }, [orgId, workspaceId, storageKey, activeKey]);

  // Save sectionTimes to localStorage whenever they change
  useEffect(() => {
    if (!orgId || !workspaceId) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(sectionTimes));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }, [sectionTimes, orgId, workspaceId, storageKey]);

  // Interval to update currentElapsed every second when a timer is running
  useEffect(() => {
    if (activeSection === null) {
      setCurrentElapsed(0);
      return;
    }

    const intervalId = setInterval(() => {
      const start = timerStartTimeRef.current;
      if (start !== null) {
        setCurrentElapsed(Date.now() - start);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeSection]);

  const persistActiveState = useCallback(
    (section: string | null, startTime: number | null) => {
      if (!orgId || !workspaceId) return;
      try {
        if (section && startTime !== null) {
          const state: ActiveTimerState = { section, startTime };
          localStorage.setItem(activeKey, JSON.stringify(state));
        } else {
          localStorage.removeItem(activeKey);
        }
      } catch {
        // Silently fail
      }
    },
    [orgId, workspaceId, activeKey],
  );

  const accumulateActive = useCallback(() => {
    const section = activeSectionRef.current;
    const start = timerStartTimeRef.current;
    if (section && start !== null) {
      const elapsed = Date.now() - start;
      setSectionTimes((prev) => {
        const updated = { ...prev, [section]: (prev[section] ?? 0) + elapsed };
        sectionTimesRef.current = updated;
        return updated;
      });
    }
  }, []);

  const startTimer = useCallback(
    (section: string) => {
      // If this section is already active, no-op to avoid losing elapsed time
      if (activeSectionRef.current === section) return;

      // If another section is active, accumulate its time first
      if (activeSectionRef.current) {
        accumulateActive();
      }

      const now = Date.now();
      timerStartTimeRef.current = now;
      setActiveSection(section);
      activeSectionRef.current = section;
      setCurrentElapsed(0);
      persistActiveState(section, now);
    },
    [accumulateActive, persistActiveState],
  );

  const pauseTimer = useCallback(() => {
    accumulateActive();
    timerStartTimeRef.current = null;
    setActiveSection(null);
    activeSectionRef.current = null;
    setCurrentElapsed(0);
    persistActiveState(null, null);
  }, [accumulateActive, persistActiveState]);

  const stopTimer = useCallback(() => {
    accumulateActive();
    timerStartTimeRef.current = null;
    setActiveSection(null);
    activeSectionRef.current = null;
    setCurrentElapsed(0);
    persistActiveState(null, null);
  }, [accumulateActive, persistActiveState]);

  const getTotalTime = useCallback(
    (section: string): number => {
      const accumulated = sectionTimesRef.current[section] ?? 0;
      if (activeSectionRef.current === section && timerStartTimeRef.current !== null) {
        return accumulated + currentElapsed;
      }
      return accumulated;
    },
    [currentElapsed],
  );

  const getAllTimes = useCallback((): Record<string, number> => {
    return { ...sectionTimesRef.current };
  }, []);

  const clearSectionTime = useCallback(
    (section: string) => {
      if (activeSectionRef.current === section) {
        timerStartTimeRef.current = null;
        setActiveSection(null);
        activeSectionRef.current = null;
        setCurrentElapsed(0);
        persistActiveState(null, null);
      }
      setSectionTimes((prev) => {
        const updated = { ...prev };
        delete updated[section];
        sectionTimesRef.current = updated;
        return updated;
      });
    },
    [persistActiveState],
  );

  const clearAllTimes = useCallback(() => {
    timerStartTimeRef.current = null;
    setActiveSection(null);
    activeSectionRef.current = null;
    setCurrentElapsed(0);
    setSectionTimes({});
    sectionTimesRef.current = {};
    persistActiveState(null, null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silently fail
    }
  }, [persistActiveState, storageKey]);

  const formatTime = useCallback((ms: number): string => {
    if (ms <= 0) return '0s';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
  }, []);

  return {
    activeSection,
    startTimer,
    pauseTimer,
    stopTimer,
    getTotalTime,
    getAllTimes,
    clearSectionTime,
    clearAllTimes,
    formatTime,
  };
}
