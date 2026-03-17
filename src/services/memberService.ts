import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase.ts';
import type { OrgRole } from '../types/index.ts';

// --- createInvite ---
interface CreateInviteInput {
  orgId: string;
  email: string;
  role: OrgRole;
}

interface CreateInviteOutput {
  inviteId: string;
  inviteUrl: string;
}

export async function callCreateInvite(input: CreateInviteInput): Promise<CreateInviteOutput> {
  const fn = httpsCallable<CreateInviteInput, CreateInviteOutput>(functions, 'createInvite');
  const result = await fn(input);
  return result.data;
}

// --- acceptInvite ---
interface AcceptInviteInput {
  token: string;
}

interface AcceptInviteOutput {
  orgId: string;
  orgName: string;
}

export async function callAcceptInvite(input: AcceptInviteInput): Promise<AcceptInviteOutput> {
  const fn = httpsCallable<AcceptInviteInput, AcceptInviteOutput>(functions, 'acceptInvite');
  const result = await fn(input);
  return result.data;
}

// --- changeMemberRole ---
interface ChangeMemberRoleInput {
  orgId: string;
  targetUid: string;
  newRole: OrgRole;
}

export async function callChangeMemberRole(input: ChangeMemberRoleInput): Promise<void> {
  const fn = httpsCallable<ChangeMemberRoleInput, void>(functions, 'changeMemberRole');
  await fn(input);
}

// --- removeMember ---
interface RemoveMemberInput {
  orgId: string;
  targetUid: string;
}

export async function callRemoveMember(input: RemoveMemberInput): Promise<void> {
  const fn = httpsCallable<RemoveMemberInput, void>(functions, 'removeMember');
  await fn(input);
}
