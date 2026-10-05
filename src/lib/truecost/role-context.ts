import type { AppRole } from './auth';

const STORAGE_KEY = 'truecost.activeRole';

export function getStoredActiveRole(): AppRole | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(STORAGE_KEY);

  if (
    value === 'host' ||
    value === 'planner' ||
    value === 'vendor' ||
    value === 'admin'
  ) {
    return value;
  }

  return null;
}

export function setStoredActiveRole(role: AppRole) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, role);
}

export function clearStoredActiveRole() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
