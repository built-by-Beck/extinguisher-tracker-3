/**
 * Floor / location label normalization for inspection UI grouping and cleanup.
 * Display/group only during ordinary page loads — do not rewrite Firestore
 * unless an explicit cleanup action runs.
 *
 * Author: built_by_Beck
 */

const ORDINAL_SUFFIX: Record<number, string> = {
  1: 'st',
  2: 'nd',
  3: 'rd',
};

const WORD_TO_NUMBER: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
};

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${ORDINAL_SUFFIX[n % 10] ?? 'th'}`;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Strip punctuation and normalize common abbreviations for matching.
 */
export function normalizeLocationLabelKey(
  value: string | null | undefined,
): string {
  return collapseWhitespace((value ?? '').toString().toLowerCase())
    .replace(/[.]/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Canonical floor display label, or null when the text is not a floor.
 *
 * Examples:
 *   " 2ND fl. " → "2nd Floor"
 *   "Second Floor" → "2nd Floor"
 *   "floor 2" → "2nd Floor"
 *   "bsmt" → "Basement"
 */
export function normalizeFloorLabel(
  value: string | null | undefined,
): string | null {
  const raw = collapseWhitespace((value ?? '').toString());
  if (!raw) return null;

  const t = normalizeLocationLabelKey(raw);
  if (!t) return null;

  if (
    /\b(basement|bsmt|bmt|basement level)\b/.test(t) ||
    t === 'basement' ||
    t === 'bsmt'
  ) {
    return 'Basement';
  }
  if (
    /\b(ground|grnd|ground floor|ground level|ground fl)\b/.test(t) ||
    t === 'ground' ||
    t === 'grnd'
  ) {
    return 'Ground Floor';
  }
  if (/\b(mezzanine|mezz)\b/.test(t)) return 'Mezzanine';
  if (/\b(penthouse|ph)\b/.test(t) || t === 'ph') return 'Penthouse';
  if (/\b(roof|rooftop|roof level)\b/.test(t)) return 'Roof';

  // Written ordinals: "second floor", "first"
  for (const [word, n] of Object.entries(WORD_TO_NUMBER)) {
    if (
      new RegExp(`\\b${word}\\b(?:\\s*(?:floor|flr|fl|level|lvl))?`).test(t)
    ) {
      return `${ordinal(n)} Floor`;
    }
  }

  // Bare number or ordinal: "2", "2nd", "2nd fl", "fl 2", "floor 2", "level 2"
  const patterns = [
    /^(\d{1,3})(?:st|nd|rd|th)?(?:\s*(?:floor|flr|fl|level|lvl))?$/,
    /\b(\d{1,3})(?:st|nd|rd|th)?\s*(?:floor|flr|fl)\b/,
    /\b(?:floor|flr|fl|level|lvl)\.?\s*(\d{1,3})(?:st|nd|rd|th)?\b/,
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
 * Parse a normalized floor label from arbitrary vicinity/section text.
 * Returns null when no floor can be confidently identified.
 */
export function parseFloorFromText(
  text: string | null | undefined,
): string | null {
  const t = (text ?? '').toString().toLowerCase().trim();
  if (!t) return null;

  // Prefer full-string floor normalization when the whole string is a floor label.
  const asWhole = normalizeFloorLabel(text);
  if (asWhole) return asWhole;

  if (/\b(basement|bsmt|bmt)\b/.test(t)) return 'Basement';
  if (/\b(ground|grnd)\b/.test(t)) return 'Ground Floor';
  if (/\b(mezzanine|mezz)\b/.test(t)) return 'Mezzanine';
  if (/\b(penthouse|ph)\b/.test(t)) return 'Penthouse';
  if (/\b(roof|rooftop)\b/.test(t)) return 'Roof';

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
 * Sort key for floor labels (Basement < Ground < Mezz < 1st < … < Penthouse/Roof).
 */
export function floorSortRank(label: string | null | undefined): number {
  const canonical = normalizeFloorLabel(label) ?? (label ?? '').toString();
  const t = canonical.toLowerCase().trim();
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

/** Natural floor ordering for display lists. */
export function sortFloorsNaturally(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const rankDiff = floorSortRank(a) - floorSortRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

/** Location types treated as floors in inspection navigation / cleanup. */
const FLOOR_LIKE_LOCATION_TYPES = new Set([
  'floor',
  'basement',
  'attic',
  'parking_deck',
  'ground',
  'mezzanine',
  'penthouse',
  'roof',
]);

export function isFloorLikeLocationType(
  locationType: string | null | undefined,
): boolean {
  if (!locationType) return false;
  return FLOOR_LIKE_LOCATION_TYPES.has(locationType.toLowerCase());
}
