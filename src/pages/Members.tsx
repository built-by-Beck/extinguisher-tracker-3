import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { UserPlus, Users, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { InviteModal } from '../components/members/InviteModal.tsx';
import { MemberRow } from '../components/members/MemberRow.tsx';
import type { OrgMember } from '../types/index.ts';

interface MemberEntry {
  id: string;
  data: OrgMember;
}

export default function Members() {
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const navigate = useNavigate();
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const canManage = hasRole(['owner', 'admin']);
  const orgId = userProfile?.activeOrgId ?? '';
  const canAccessMembers = hasFeature(org?.featureFlags, 'teamMembers', org?.plan);

  if (!canAccessMembers) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Lock className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
          <p className="mt-2 text-sm text-gray-600">
            Invite and manage team members with Elite and Enterprise plans.
            Upgrade to add inspectors, admins, and viewers to your organization.
          </p>
          <button
            onClick={() => navigate('/dashboard/settings')}
            className="mt-6 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            View Plans & Upgrade
          </button>
        </div>
      </div>
    );
  }

  // Real-time listener for members
  useEffect(() => {
    if (!user || !orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const membersRef = collection(doc(db, 'org', orgId), 'members');
    const membersQuery = query(membersRef, where('status', 'in', ['active', 'invited', 'suspended']));

    const unsub = onSnapshot(
      membersQuery,
      (snapshot) => {
        const entries: MemberEntry[] = [];
        snapshot.forEach((memberDoc) => {
          entries.push({
            id: memberDoc.id,
            data: memberDoc.data() as OrgMember,
          });
        });
        // Sort: owner first, then by displayName
        entries.sort((a, b) => {
          if (a.data.role === 'owner' && b.data.role !== 'owner') return -1;
          if (b.data.role === 'owner' && a.data.role !== 'owner') return 1;
          return a.data.displayName.localeCompare(b.data.displayName);
        });
        setMembers(entries);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user, orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Members</h1>
            <p className="text-sm text-gray-500">
              {members.length} member{members.length !== 1 ? 's' : ''} in {org?.name ?? 'this organization'}
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Page description */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <p>
          Manage who has access to your organization. Invite team members by email and assign
          them a role — Owners and Admins can manage settings and data, Inspectors can perform
          inspections in the field, and Viewers have read-only access for audits or oversight.
        </p>
      </div>

      {/* Members table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Joined
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((entry) => (
              <MemberRow
                key={entry.id}
                member={entry.data}
                memberId={entry.id}
                orgId={orgId}
                currentUid={user?.uid ?? ''}
                canManage={canManage}
              />
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  No members found. Invite someone to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {showInvite && orgId && (
        <InviteModal
          orgId={orgId}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            // Keep modal open to show invite URL
          }}
        />
      )}
    </div>
  );
}
