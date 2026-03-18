/**
 * ComplianceSummaryCard
 * A clickable card showing a compliance metric count + label + color.
 * Used on the Dashboard compliance overview section.
 *
 * Author: built_by_Beck
 */

import { getComplianceSeverity, getComplianceLabel } from '../../utils/compliance.ts';

interface ComplianceSummaryCardProps {
  /** Compliance status value (drives color scheme), or a special key like 'total' */
  status: string;
  /** Count to display */
  count: number;
  /** Override label (optional — defaults to getComplianceLabel) */
  label?: string;
  /** Click handler — typically navigates to filtered inventory */
  onClick?: () => void;
}

const cardColorMap: Record<string, string> = {
  success: 'border-green-200 bg-green-50 hover:bg-green-100',
  warning: 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100',
  danger: 'border-red-200 bg-red-50 hover:bg-red-100',
  neutral: 'border-gray-200 bg-gray-50 hover:bg-gray-100',
};

const countColorMap: Record<string, string> = {
  success: 'text-green-700',
  warning: 'text-yellow-700',
  danger: 'text-red-700',
  neutral: 'text-gray-600',
};

const labelColorMap: Record<string, string> = {
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
  neutral: 'text-gray-500',
};

export function ComplianceSummaryCard({ status, count, label, onClick }: ComplianceSummaryCardProps) {
  // 'total' is a special non-compliance status used for the "All Active" card
  const severity = status === 'total' ? 'neutral' : getComplianceSeverity(status);
  const resolvedLabel = label ?? (status === 'total' ? 'Total Active' : getComplianceLabel(status));

  const cardClass = cardColorMap[severity];
  const countClass = countColorMap[severity];
  const labelClass = labelColorMap[severity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-lg border p-4 shadow-sm transition-colors ${cardClass} ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <span className={`text-2xl font-bold ${countClass}`}>{count}</span>
      <span className={`mt-1 text-sm font-medium ${labelClass}`}>{resolvedLabel}</span>
    </button>
  );
}
