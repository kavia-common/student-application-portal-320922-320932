/**
 * Minimal fetch-based API client for the Student Application Portal.
 *
 * Env:
 *  - REACT_APP_API_BASE_URL (e.g., https://...:3001)
 */

function normalizeBase(apiBase) {
  return (apiBase || '').replace(/\/$/, '');
}

async function parseJsonOrText(resp) {
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return resp.json();
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFromResponse(status, data) {
  if (data && typeof data === 'object') {
    // FastAPI often returns {detail: "..."} or {detail: {...}}
    const detail = data.detail ?? data;
    if (typeof detail === 'string') return new Error(detail);
    return new Error(`${status}: ${JSON.stringify(detail)}`);
  }
  return new Error(`${status}: ${String(data)}`);
}

async function request({ apiBase, path, method = 'GET', token, body }) {
  const url = `${normalizeBase(apiBase)}${path}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await parseJsonOrText(resp);
  if (!resp.ok) throw errorFromResponse(resp.status, data);
  return data;
}

// PUBLIC_INTERFACE
export async function apiRegister({ apiBase, email, password, first_name, last_name }) {
  /** Register a new student user and return TokenResponse. */
  return request({
    apiBase,
    path: '/auth/register',
    method: 'POST',
    body: { email, password, first_name, last_name }
  });
}

// PUBLIC_INTERFACE
export async function apiLogin({ apiBase, email, password }) {
  /** Login and return TokenResponse. */
  return request({
    apiBase,
    path: '/auth/login',
    method: 'POST',
    body: { email, password }
  });
}

// PUBLIC_INTERFACE
export async function apiMe({ apiBase, token }) {
  /** Get current authenticated user. */
  return request({
    apiBase,
    path: '/auth/me',
    method: 'GET',
    token
  });
}

// PUBLIC_INTERFACE
export async function apiListMyApplications({ apiBase, token }) {
  /** List applications for current student. */
  return request({
    apiBase,
    path: '/applications/my',
    method: 'GET',
    token
  });
}

// PUBLIC_INTERFACE
export async function apiCreateApplication({ apiBase, token, program, term }) {
  /** Create a draft application. */
  return request({
    apiBase,
    path: '/applications',
    method: 'POST',
    token,
    body: { program, term }
  });
}

// PUBLIC_INTERFACE
export async function apiSubmitApplication({ apiBase, token, applicationId }) {
  /** Submit an application. */
  return request({
    apiBase,
    path: `/applications/${applicationId}/submit`,
    method: 'POST',
    token
  });
}

// PUBLIC_INTERFACE
export async function apiWithdrawApplication({ apiBase, token, applicationId }) {
  /** Withdraw an application. */
  return request({
    apiBase,
    path: `/applications/${applicationId}/withdraw`,
    method: 'POST',
    token
  });
}

// PUBLIC_INTERFACE
export async function apiAdminListApplications({ apiBase, token, status, q, limit = 50, offset = 0 }) {
  /** Admin list applications with optional filters. */
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  return request({
    apiBase,
    path: `/admin/applications?${params.toString()}`,
    method: 'GET',
    token
  });
}

// PUBLIC_INTERFACE
export async function apiAdminChangeStatus({ apiBase, token, applicationId, to_status, reason }) {
  /** Admin change application status. */
  return request({
    apiBase,
    path: `/admin/applications/${applicationId}/status`,
    method: 'POST',
    token,
    body: { to_status, reason }
  });
}
