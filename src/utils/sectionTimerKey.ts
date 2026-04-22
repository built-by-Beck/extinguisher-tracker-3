/**
 * Resolve the localStorage bucket key for section time tracking.
 * Matches WorkspaceDetail leaf view: `drillDown.currentLocation?.name` — the
 * assigned location's display name, with legacy fallback to section string.
 */

import type { Extinguisher } from '../services/extinguisherService.ts';
import type { Inspection } from '../services/inspectionService.ts';
import type { Location } from '../services/locationService.ts';

export type SectionTimerExtinguisherPlacement = Pick<Extinguisher, 'locationId' | 'section'>;
export type SectionTimerInspectionPlacement = Pick<Inspection, 'locationId' | 'section'>;

export function resolveSectionTimerKey(
  ext: SectionTimerExtinguisherPlacement,
  locations: Location[],
  inspection?: SectionTimerInspectionPlacement | null,
): string {
  const locId = ext.locationId ?? inspection?.locationId ?? null;
  if (locId) {
    const loc = locations.find((l) => l.id === locId);
    const name = loc?.name?.trim();
    if (name) return name;
  }
  const fromExt = (ext.section ?? '').trim();
  if (fromExt) return fromExt;
  return (inspection?.section ?? '').trim();
}
