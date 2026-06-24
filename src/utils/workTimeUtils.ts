/** Max continuous timer segment before auto-stop (10 hours). */
export const MAX_ACTIVE_SEGMENT_MS = 10 * 60 * 60 * 1000;

/** Max accumulated time per section per calendar day (10 hours). */
export const MAX_DAILY_MS = 10 * 60 * 60 * 1000;

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_CHECK_INTERVAL_MS = 60_000;

export const AUTO_START_TIMER_KEY = 'ex3_autoStartTimer';

export function getWorkDateLocal(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sectionToSlug(section: string): string {
  return section.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'unknown';
}

export function makeWorkTimeDocId(
  userId: string,
  workspaceId: string,
  section: string,
  workDate: string,
): string {
  return `${userId}__${workspaceId}__${sectionToSlug(section)}__${workDate}`;
}

export function formatWorkTimeMs(ms: number): string {
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
}

export function formatWorkTimeHours(ms: number): string {
  if (ms <= 0) return '0h 0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function getAutoStartTimerPreference(): boolean {
  try {
    return localStorage.getItem(AUTO_START_TIMER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoStartTimerPreference(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_START_TIMER_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function makeLegacyTimesKey(orgId: string, workspaceId: string): string {
  return `sectionTimes_${orgId}_${workspaceId}`;
}

export function makeActiveTimerKey(orgId: string, userId: string): string {
  return `sectionTimerActive_${orgId}_${userId}`;
}
