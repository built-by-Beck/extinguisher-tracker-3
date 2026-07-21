import { useState } from 'react';
import { Ban, Clock, Mail } from 'lucide-react';
import { callRevokeInvite } from '../../services/memberService.ts';
import type { Invite } from '../../types/invite.ts';

interface PendingInviteRowProps {
  inviteId: string;
  invite: Invite;
  orgId: string;
  canManage: boolean;
}

function formatExpiry(expiresAt: Invite['expiresAt']): string {
  try {
    const date =
      typeof expiresAt?.toDate === 'function'
        ? expiresAt.toDate()
        : new Date(expiresAt as unknown as string);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

export function PendingInviteRow({
  inviteId,
  invite,
  orgId,
  canManage,
}: PendingInviteRowProps) {
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');

  async function handleRevoke() {
    if (!canManage || revoking) return;
    setError('');
    setRevoking(true);
    try {
      await callRevokeInvite({ orgId, inviteId });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to revoke invite.';
      setError(message);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="text-sm text-gray-900">{invite.email}</span>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-4 py-3 text-sm capitalize text-gray-700">
        {invite.role}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        Expires {formatExpiry(invite.expiresAt)}
      </td>
      <td className="px-4 py-3">
        {canManage && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={revoking}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Ban className="h-3 w-3" />
            {revoking ? 'Revoking…' : 'Revoke'}
          </button>
        )}
      </td>
    </tr>
  );
}
