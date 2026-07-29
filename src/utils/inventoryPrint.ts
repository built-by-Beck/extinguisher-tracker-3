/**
 * Shared helpers for detailed inventory print / CSV export.
 *
 * Author: built_by_Beck
 */

import {
  isInventoryActiveRecord,
  isOfficiallyExpiredExtinguisher,
  isPossibleExpiredCandidate,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import { getLocationPath, type Location } from '../services/locationService.ts';
import { getComplianceLabel } from './compliance.ts';

export type InventoryPrintMode = 'all' | 'expired' | 'candidates';

export interface DetailedInventoryPrintRow {
  assetId: string;
  serial: string;
  barcode: string;
  type: string;
  size: string;
  manufacturer: string;
  location: string;
  floor: string;
  vicinity: string;
  category: string;
  status: string;
  expiryStatus: string;
  mfgYear: string;
  expYear: string;
  lastInspection: string;
}

function formatDate(d: unknown): string {
  if (!d) return '';
  try {
    if (
      d &&
      typeof d === 'object' &&
      'toDate' in d &&
      typeof (d as { toDate: () => Date }).toDate === 'function'
    ) {
      return (d as { toDate: () => Date })
        .toDate()
        .toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
    }
    const date = new Date(d as string | number);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(d);
  }
}

export function toDetailedPrintRow(
  ext: Extinguisher,
  locations: Location[],
  currentYear: number,
): DetailedInventoryPrintRow {
  const path =
    ext.locationId && locations.length > 0
      ? getLocationPath(locations, ext.locationId)
      : [ext.parentLocation, ext.section].filter(Boolean).join(' > ');
  const isExpired = isOfficiallyExpiredExtinguisher(ext);
  const isCandidate = isPossibleExpiredCandidate(ext, currentYear);
  return {
    assetId: ext.assetId || '',
    serial: ext.serial || '',
    barcode: ext.barcode || '',
    type: ext.extinguisherType || '',
    size: ext.extinguisherSize || '',
    manufacturer: ext.manufacturer || '',
    location: path || '',
    floor: ext.floor || '',
    vicinity: ext.vicinity || '',
    category: ext.category || '',
    status: (ext.complianceStatus
      ? getComplianceLabel(ext.complianceStatus)
      : ext.category || ''
    ).toUpperCase(),
    expiryStatus: isExpired
      ? 'MARKED EXPIRED'
      : isCandidate
        ? 'POSSIBLE CANDIDATE'
        : '',
    mfgYear: ext.manufactureYear != null ? String(ext.manufactureYear) : '',
    expYear: ext.expirationYear != null ? String(ext.expirationYear) : '',
    lastInspection: formatDate(ext.lastMonthlyInspection),
  };
}

export function filterExtinguishersForPrint(params: {
  items: Extinguisher[];
  mode: InventoryPrintMode;
  locationScopeIds: Set<string> | null;
  currentYear: number;
}): Extinguisher[] {
  const { items, mode, locationScopeIds, currentYear } = params;
  return items.filter((ext) => {
    if (locationScopeIds) {
      if (!ext.locationId || !locationScopeIds.has(ext.locationId))
        return false;
    }
    if (mode === 'all') return true;
    if (!isInventoryActiveRecord(ext as unknown as Record<string, unknown>))
      return false;
    if (mode === 'expired') return isOfficiallyExpiredExtinguisher(ext);
    return isPossibleExpiredCandidate(ext, currentYear);
  });
}
