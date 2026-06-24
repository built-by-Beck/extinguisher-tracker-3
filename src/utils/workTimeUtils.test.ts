import { describe, expect, it } from 'vitest';
import {
  formatWorkTimeHours,
  formatWorkTimeMs,
  getWorkDateLocal,
  makeWorkTimeDocId,
  MAX_ACTIVE_SEGMENT_MS,
  MAX_DAILY_MS,
  sectionToSlug,
} from './workTimeUtils.ts';
import { aggregateWorkTimeRows } from '../services/workTimeService.ts';
import type { WorkTimeDaily } from '../services/workTimeService.ts';

describe('workTimeUtils', () => {
  it('formats milliseconds as h/m/s parts', () => {
    expect(formatWorkTimeMs(3661000)).toBe('1h 1m 1s');
    expect(formatWorkTimeMs(0)).toBe('0s');
  });

  it('formats hours and minutes for summaries', () => {
    expect(formatWorkTimeHours(5400000)).toBe('1h 30m');
    expect(formatWorkTimeHours(60000)).toBe('1m');
  });

  it('builds stable doc ids from section slugs', () => {
    expect(makeWorkTimeDocId('uid', 'ws', 'Lobby Area', '2026-06-22')).toBe(
      'uid__ws__lobby_area__2026-06-22',
    );
    expect(sectionToSlug('Mechanical Room')).toBe('mechanical_room');
  });

  it('uses local calendar date for workDate', () => {
    const date = new Date(2026, 5, 22, 15, 0, 0);
    expect(getWorkDateLocal(date)).toBe('2026-06-22');
  });

  it('caps constants match 10 hour policy', () => {
    expect(MAX_ACTIVE_SEGMENT_MS).toBe(10 * 60 * 60 * 1000);
    expect(MAX_DAILY_MS).toBe(10 * 60 * 60 * 1000);
  });
});

describe('aggregateWorkTimeRows', () => {
  const rows: WorkTimeDaily[] = [
    {
      id: '1',
      userId: 'u1',
      userEmail: 'a@test.com',
      workspaceId: 'ws1',
      workspaceLabel: 'June',
      locationId: null,
      section: 'Lobby',
      workDate: '2026-06-22',
      durationMs: 3600000,
      updatedAt: null,
    },
    {
      id: '2',
      userId: 'u1',
      userEmail: 'a@test.com',
      workspaceId: 'ws1',
      workspaceLabel: 'June',
      locationId: null,
      section: 'Lobby',
      workDate: '2026-06-21',
      durationMs: 1800000,
      updatedAt: null,
    },
  ];

  it('sums today and workspace totals per member/section', () => {
    const aggregated = aggregateWorkTimeRows(rows, '2026-06-22');
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]?.todayMs).toBe(3600000);
    expect(aggregated[0]?.totalMs).toBe(5400000);
  });
});
