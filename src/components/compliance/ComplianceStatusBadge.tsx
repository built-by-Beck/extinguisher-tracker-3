/**
 * ComplianceStatusBadge
 * Renders a colored badge based on compliance status.
 *
 * Author: built_by_Beck
 */

import { getComplianceLabel, getComplianceSeverity } from '../../utils/compliance.ts';

interface ComplianceStatusBadgeProps {
  status: string | null;
  size?: 'sm' | 'md';
}

const severityClasses = {
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function ComplianceStatusBadge({ status, size = 'md' }: ComplianceStatusBadgeProps) {
  const resolvedStatus = status ?? 'missing_data';
  const severity = getComplianceSeverity(resolvedStatus);
  const label = getComplianceLabel(resolvedStatus);
  const classes = severityClasses[severity];

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2 py-0.5 text-xs font-medium';

  return (
    <span className={`inline-block rounded-full border ${classes} ${sizeClasses}`}>
      {label}
    </span>
  );
}
