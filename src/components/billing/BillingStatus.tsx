import { ShieldCheck, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useOrg } from '../../hooks/useOrg.ts';

const statusConfig: Record<string, { icon: typeof ShieldCheck; color: string; bgColor: string; label: string }> = {
  active: { icon: ShieldCheck, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', label: 'Active' },
  trialing: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', label: 'Trial' },
  past_due: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', label: 'Past Due' },
  unpaid: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', label: 'Unpaid' },
  canceled: { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', label: 'Canceled' },
};

export function BillingStatus() {
  const { org } = useOrg();

  if (!org?.subscriptionStatus) return null;

  const config = statusConfig[org.subscriptionStatus] ?? statusConfig.canceled;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
