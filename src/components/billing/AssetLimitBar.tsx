import { useOrg } from '../../hooks/useOrg.ts';

interface AssetLimitBarProps {
  currentCount: number;
}

export function AssetLimitBar({ currentCount }: AssetLimitBarProps) {
  const { org } = useOrg();
  const limit = org?.assetLimit;

  if (!limit) return null; // unlimited plan

  const percentage = Math.min((currentCount / limit) * 100, 100);
  const isWarning = percentage >= 80;
  const isAtLimit = currentCount >= limit;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">Asset Usage</span>
        <span className={`font-semibold ${isAtLimit ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-gray-900'}`}>
          {currentCount} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full transition-all ${
            isAtLimit ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isAtLimit && (
        <p className="mt-2 text-xs text-red-600">
          You've reached your asset limit. Upgrade your plan to add more extinguishers.
        </p>
      )}
      {isWarning && !isAtLimit && (
        <p className="mt-2 text-xs text-orange-600">
          Approaching asset limit. Consider upgrading your plan.
        </p>
      )}
    </div>
  );
}
