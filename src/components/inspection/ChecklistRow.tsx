/**
 * ChecklistRow — pure presentational component for a single NFPA checklist item.
 * Renders pass/fail/n-a toggle buttons for one checklist key.
 *
 * Author: built_by_Beck
 */

export type CheckValue = 'pass' | 'fail' | 'n/a';

interface ChecklistRowProps {
  label: string;
  value: CheckValue;
  onChange: (v: CheckValue) => void;
  disabled: boolean;
}

export function ChecklistRow({ label, value, onChange, disabled }: ChecklistRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-1">
        {(['pass', 'fail', 'n/a'] as CheckValue[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            disabled={disabled}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              value === v
                ? v === 'pass'
                  ? 'bg-green-500 text-white'
                  : v === 'fail'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {v === 'n/a' ? 'N/A' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
