import type { CallableRequest } from 'firebase-functions/v2/https';
import { throwUnauthenticated } from './errors.js';

/**
 * Validates that a callable request has an authenticated user.
 * Returns the authenticated uid and email.
 */
export function validateAuth(request: CallableRequest): { uid: string; email: string } {
  if (!request.auth) {
    throwUnauthenticated();
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email;

  if (!email) {
    throwUnauthenticated('Authenticated user does not have an email address.');
  }

  return { uid, email };
}
