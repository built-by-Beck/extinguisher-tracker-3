/**
 * floorParsing — derive a normalized floor label from free text.
 *
 * Many imported extinguishers carry the floor inside the vicinity/section
 * string (e.g. "2nd Floor, near elevator B"). This util extracts a stable,
 * human-readable floor label so we can populate a dedicated floor field and
 * group extinguishers by floor location.
 *
 * Author: built_by_Beck
 */

const ORDINAL_SUFFIX: Record<number, string> = {
  1: 'st',
  2: 'nd',
  3: 'rd',
};

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${ORDINAL_SUFFIX[n % 10] ?? 'th'}`;
}

/**
 * Parse a normalized floor label from arbitrary text (vicinity/section).
 * Returns null when no floor can be confidently identified.
 *
 * Examples:
 *   "2nd Floor, east wall" -> "2nd Floor"
 *   "Basement near boiler"  -> "Basement"
 *   "GROUND - lobby"        -> "Ground Floor"
 *   "fl 3"                  -> "3rd Floor"
 *   "near elevator"         -> null
 */
export function parseFloorFromText(
  text: string | null | undefined,
): string | null {
  const t = (text ?? '').toString().toLowerCase().trim();
  if (!t) return null;

  if (/\b(basement|bsmt|bmt)\b/.test(t)) return 'Basement';
  if (/\b(ground|grnd)\b/.test(t)) return 'Ground Floor';
  if (/\b(mezzanine|mezz)\b/.test(t)) return 'Mezzanine';
  if (/\b(penthouse)\b/.test(t)) return 'Penthouse';
  if (/\b(roof|rooftop)\b/.test(t)) return 'Roof';

  // "2nd floor", "3 fl", "floor 4", "fl. 5", "level 6", "lvl 2"
  const patterns = [
    /\b(\d{1,3})(?:st|nd|rd|th)?\s*(?:floor|flr|fl)\b/,
    /\b(?:floor|flr|fl|level|lvl)\.?\s*(\d{1,3})\b/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0 && n < 200) {
        return `${ordinal(n)} Floor`;
      }
    }
  }

  return null;
}

/**
 * A sort key for floor labels so floors order naturally
 * (Basement < Ground < Mezzanine < 1st < 2nd < ... < Penthouse/Roof).
 */
export function floorSortRank(label: string | null | undefined): number {
  const t = (label ?? '').toString().toLowerCase().trim();
  if (!t) return Number.MAX_SAFE_INTEGER;
  if (t.includes('basement')) return -100;
  if (t.includes('ground')) return 0;
  if (t.includes('mezz')) return 1;
  if (t.includes('penthouse')) return 9000;
  if (t.includes('roof')) return 9001;
  const m = t.match(/(\d{1,3})/);
  if (m) return Number.parseInt(m[1], 10) + 1;
  return Number.MAX_SAFE_INTEGER;
}
