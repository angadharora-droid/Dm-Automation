/**
 * Dashboard API client.
 *
 * Auth is either a session token from POST /api/auth/login (username/password
 * sign-in — the password itself is never stored) or the raw admin API key.
 * `base` is '' when the dashboard is served by the backend itself; when hosted
 * separately it is the backend's URL and that page's origin must be listed in
 * the backend's ALLOWED_ORIGINS.
 */

function authHeaders(auth) {
  if (auth?.mode === 'key' && auth.adminKey) return { 'x-admin-key': auth.adminKey };
  if (auth?.token) return { authorization: `Bearer ${auth.token}` };
  return {};
}

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    if (body?.error) return body.error;
  } catch {
    /* non-JSON error body */
  }
  return fallback;
}

export async function apiGet(base, auth, path) {
  const res = await fetch(base + path, { headers: authHeaders(auth) });
  if (res.status === 401) {
    throw new Error(
      auth?.mode === 'key' ? 'Invalid admin key.' : 'Session expired — please sign in again.',
    );
  }
  if (res.status === 503) throw new Error(await parseError(res, 'Admin access is disabled on the server.'));
  if (!res.ok) throw new Error(`Request failed (${res.status}).`);
  return res.json();
}

/** Exchanges username/password for a session token. */
export async function login(base, username, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, `Sign-in failed (${res.status}).`));
  }
  return res.json(); // { token, expiresAt }
}

const STORAGE_KEY = 'ig-automation-session';

/* sessionStorage can throw in private browsing modes — degrade gracefully. */
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      mode: parsed.mode === 'key' ? 'key' : 'password',
      adminKey: parsed.adminKey || '',
      token: parsed.token || '',
      backendUrl: parsed.backendUrl || '',
    };
  } catch {
    return { mode: 'password', adminKey: '', token: '', backendUrl: '' };
  }
}

export function saveSession(session) {
  try {
    const { mode, adminKey, token, backendUrl } = session;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, adminKey, token, backendUrl }));
  } catch {
    /* session just won't persist across reloads */
  }
}

export function clearSessionAuth(session) {
  const next = { ...session, adminKey: '', token: '' };
  saveSession(next);
  return next;
}

export function normalizeBaseUrl(value) {
  return (value || '').trim().replace(/\/+$/, '');
}
