import { useState } from 'react';
import { Trash2, Shield, Crown, Eye, ClipboardCheck } from 'lucide-react';
import { callChangeMemberRole, callRemoveMember } from '../../services/memberService.ts';
import type { OrgMember, OrgRole } from '../../types/index.ts';

interface MemberRowProps {
  member: OrgMember;
  memberId: string;
  orgId: string;
  currentUid: string;
  canManage: boolean;
}

const roleBadgeStyles: Record<OrgRole, string> = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-800',
  inspector: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-700',
  guest: 'bg-orange-100 text-orange-700',
};

const roleIcons: Record<OrgRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  inspector: ClipboardCheck,
  viewer: Eye,
  guest: Eye,
};

const statusBadgeStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  invited: 'bg-blue-100 text-blue-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  removed: 'bg-red-100 text-red-800',
};

const availableRoles: { value: OrgRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'inspector', label: 'Inspector' },
  { value: 'viewer', label: 'Viewer' },
];

export function MemberRow({ member, memberId, orgId, currentUid, canManage }: MemberRowProps) {
  const [roleLoading, setRoleLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');

  const isCurrentUser = memberId === currentUid;
  const isOwner = member.role === 'owner';
  const RoleIcon = roleIcons[member.role];

  async function handleRoleChange(newRole: OrgRole) {
    if (newRole === member.role) return;
    setError('');
    setRoleLoading(true);
    try {
      await callChangeMemberRole({ orgId, targetUid: memberId, newRole });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change role.';
      setError(message);
    } finally {
      setRoleLoading(false);
    }
  }

  async function handleRemove() {
    setError('');
    setRemoveLoading(true);
    try {
      await callRemoveMember({ orgId, targetUid: memberId });
      setConfirmRemove(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove member.';
      setError(message);
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <tr className={`border-b border-gray-100 ${isCurrentUser ? 'bg-blue-50/50' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
            {member.displayName?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {member.displayName}
              {isCurrentUser && <span className="ml-1 text-xs text-gray-400">(you)</span>}
            </p>
            <p className="text-xs text-gray-500">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeStyles[member.role]}`}>
          <RoleIcon className="h-3 w-3" />
          {member.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyles[member.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {member.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {member.joinedAt ? new Date(member.joinedAt.seconds * 1000).toLocaleDateString() : '--'}
      </td>
      <td className="px-4 py-3">
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
        {canManage && !isOwner && !isCurrentUser && member.status === 'active' && (
          <div className="flex items-center gap-2">
            <select
              value={member.role}
              onChange={(e) => handleRoleChange(e.target.value as OrgRole)}
              disabled={roleLoading}
              className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-red-500 focus:outline-none disabled:opacity-50"
            >
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            {confirmRemove ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRemove}
                  disabled={removeLoading}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {removeLoading ? '...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Remove member"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
