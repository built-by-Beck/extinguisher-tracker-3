import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSectionTimer } from './useSectionTimer.ts';

const NOW = new Date('2026-05-07T12:00:00.000Z');
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

describe('useSectionTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('stops stale restored timers immediately and caps the restored elapsed time', async () => {
    localStorage.setItem('sectionTimes_org_ws', JSON.stringify({ Lobby: 1000 }));
    localStorage.setItem(
      'sectionTimerActive_org_ws',
      JSON.stringify({ section: 'Lobby', startTime: Date.now() - 2 * 24 * 60 * 60 * 1000 }),
    );

    const { result } = renderHook(() => useSectionTimer('org', 'ws'));

    await act(async () => undefined);

    expect(result.current.activeSection).toBeNull();
    expect(result.current.getTotalTime('Lobby')).toBe(1000 + IDLE_TIMEOUT_MS);
    expect(localStorage.getItem('sectionTimerActive_org_ws')).toBeNull();
  });

  it('does not drop elapsed time when the same section is started twice', () => {
    const { result } = renderHook(() => useSectionTimer('org', 'ws'));

    act(() => result.current.startTimer('Lobby'));
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.startTimer('Lobby'));
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.pauseTimer());

    expect(result.current.getTotalTime('Lobby')).toBe(7000);
  });

  it('accumulates the previous section before switching to a new section', () => {
    const { result } = renderHook(() => useSectionTimer('org', 'ws'));

    act(() => result.current.startTimer('Lobby'));
    act(() => vi.advanceTimersByTime(10000));
    act(() => result.current.startTimer('Mechanical Room'));
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.stopTimer());

    expect(result.current.getTotalTime('Lobby')).toBe(10000);
    expect(result.current.getTotalTime('Mechanical Room')).toBe(5000);
    expect(result.current.activeSection).toBeNull();
  });

  it('clears active and accumulated timers when reset all is invoked', () => {
    const { result } = renderHook(() => useSectionTimer('org', 'ws'));

    act(() => result.current.startTimer('Lobby'));
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.pauseTimer());
    act(() => result.current.clearAllTimes());

    expect(result.current.activeSection).toBeNull();
    expect(result.current.getTotalTime('Lobby')).toBe(0);
    expect(localStorage.getItem('sectionTimes_org_ws')).toBeNull();
    expect(localStorage.getItem('sectionTimerActive_org_ws')).toBeNull();
  });
});
