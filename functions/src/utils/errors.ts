import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Throws an unauthenticated error.
 */
export function throwUnauthenticated(message = 'You must be authenticated to perform this action.'): never {
  throw new HttpsError('unauthenticated', message);
}

/**
 * Throws a permission denied error.
 */
export function throwPermissionDenied(message = 'You do not have permission to perform this action.'): never {
  throw new HttpsError('permission-denied', message);
}

/**
 * Throws an invalid argument error.
 */
export function throwInvalidArgument(message: string): never {
  throw new HttpsError('invalid-argument', message);
}

/**
 * Throws a not found error.
 */
export function throwNotFound(message: string): never {
  throw new HttpsError('not-found', message);
}

/**
 * Throws a failed precondition error.
 */
export function throwFailedPrecondition(message: string): never {
  throw new HttpsError('failed-precondition', message);
}
