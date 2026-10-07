import crypto from 'node:crypto';

export const ANONYMOUS_ESTIMATE_COOKIE = 'truecost_estimate_session';

export const SAVE_INTENT_COOKIE = 'truecost_save_intent';

export function createAnonymousSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashAnonymousSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
