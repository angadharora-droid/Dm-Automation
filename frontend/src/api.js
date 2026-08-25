/**
 * Dashboard API client. Talks to the backend's /api/dashboard/* endpoints,
 * authenticated with the x-admin-key header.
 *
 * `base` is '' when the dashboard is served by the backend itself (same
 * origin); when hosted separately it is the backend's URL, and that page's
 * origin must be listed in the backend's ALLOWED_ORIGINS.
 */
export async function apiGet(base, adminKey, path) {
  const res = await fetch(base + path, { headers: { 'x-admin-key': adminKey } });
  if (res.status === 401) throw new Error('Invalid admin key.');
  if (res.status === 503) {
    throw new Error('Admin endpoints are disabled on the server (ADMIN_API_KEY not set).');
  }
  if (!res.ok) throw new Error(`Request failed (${res.status}).`);
  return res.json();
}

const KEY_STORAGE = 'ig-automation-admin-key';
const BASE_STORAGE = 'ig-automation-backend-url';

/* sessionStorage can throw in private browsing modes — degrade gracefully. */
export function loadSession() {
  try {
    return {
      adminKey: sessionStorage.getItem(KEY_STORAGE) || '',
      backendUrl: sessionStorage.getItem(BASE_STORAGE) || '',
    };
  } catch {
    return { adminKey: '', backendUrl: '' };
  }
}

export function saveSession({ adminKey, backendUrl }) {
  try {
    if (adminKey) sessionStorage.setItem(KEY_STORAGE, adminKey);
    else sessionStorage.removeItem(KEY_STORAGE);
    if (backendUrl) sessionStorage.setItem(BASE_STORAGE, backendUrl);
    else sessionStorage.removeItem(BASE_STORAGE);
  } catch {
    /* key just won't persist across reloads */
  }
}

export function normalizeBaseUrl(value) {
  return (value || '').trim().replace(/\/+$/, '');
}
