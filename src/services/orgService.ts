import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase.ts';

interface CreateOrgInput {
  name: string;
  slug?: string;
  timezone?: string;
}

interface CreateOrgOutput {
  orgId: string;
  stripeCustomerId: string;
}

/**
 * Calls the createOrganization Cloud Function.
 */
export async function callCreateOrganization(input: CreateOrgInput): Promise<CreateOrgOutput> {
  const fn = httpsCallable<CreateOrgInput, CreateOrgOutput>(functions, 'createOrganization');
  const result = await fn(input);
  return result.data;
}
