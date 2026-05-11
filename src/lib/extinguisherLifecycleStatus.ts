/**
 * Canonical inventory lifecycle statuses for manual correction and AI tools.
 * Aligns with Firestore `lifecycleStatus` / `category` conventions.
 *
 * Author: built_by_Beck
 */

export type ExtinguisherLifecycleStatusValue =
  | 'active'
  | 'spare'
  | 'replaced'
  | 'retired'
  | 'out_of_service';

/** Map stored fields to the status dropdown value. */
export function getExtinguisherLifecycleFormValue(ext: {
  lifecycleStatus?: string | null;
  category?: string | null;
}): ExtinguisherLifecycleStatusValue {
  const ls = ext.lifecycleStatus?.toLowerCase() ?? '';
  const cat = ext.category?.toLowerCase() ?? '';
  if (ls === 'spare' || cat === 'spare') return 'spare';
  if (ls === 'replaced' || cat === 'replaced') return 'replaced';
  if (ls === 'retired' || cat === 'retired') return 'retired';
  if (ls === 'out_of_service' || cat === 'out_of_service')
    return 'out_of_service';
  return 'active';
}

export const EXTINGUISHER_LIFECYCLE_STATUS_OPTIONS: {
  value: ExtinguisherLifecycleStatusValue;
  label: string;
  description: string;
}[] = [
  {
    value: 'active',
    label: 'Active',
    description: 'In-service unit (standard inventory slot).',
  },
  {
    value: 'spare',
    label: 'Spare',
    description: 'Spare unit not assigned to a live slot.',
  },
  {
    value: 'replaced',
    label: 'Replaced',
    description: 'Marked as replaced (correct data if this was set by mistake).',
  },
  {
    value: 'retired',
    label: 'Retired',
    description:
      'Permanently out of service (metadata only here; use Retire for full workflow).',
  },
  {
    value: 'out_of_service',
    label: 'Out of service',
    description: 'Temporarily or administratively out of service.',
  },
];
