# Wedding Project — Frontend Dashboard Guide

> **Audience:** the developer (or AI assistant) building the **React customer + admin dashboard**.
> This document describes everything the backend already provides and how the dashboard must talk to it.
> The backend is a separate Go service. **Do not** add backend code to the frontend project, and never access Firestore from the frontend.

---

## 0. Quick facts

| Item | Value |
|---|---|
| API base path | `{API_URL}/api/v1` (local: `http://localhost:8080/api/v1`) |
| Interactive docs | `{API_URL}/api/docs` (Swagger UI), spec at `{API_URL}/api/docs/openapi.yaml` |
| Auth | Username + password → **HTTP-only cookie session** (`wp_session`). No JWT, no tokens in JS. |
| CSRF | Send header `X-CSRF-Token: <csrfToken>` on every `POST`/`PUT`/`PATCH`/`DELETE` |
| Fetch rule | Always `credentials: 'include'` |
| Roles | `admin`, `customer` |
| Account statuses | `active`, `disabled`, `pending_password_setup` |
| Response envelope | `{ success, data, meta? }` or `{ success: false, error: { code, message, details? }, requestId }` |
| Timestamps | RFC 3339 strings in UTC, e.g. `"2026-11-10T08:54:22Z"` |
| Dates | `YYYY-MM-DD` (wedding date, `from`/`to` filters) |

### What the backend does NOT provide (don't build UI for these)
- No email login, no self sign-up, no "forgot password" email. **Admins create accounts and reset passwords.**
- No deleting users or websites (accounts are disabled instead).
- No file uploads, no guest import, no real-time push (refetch or poll instead).

---

## 1. Local development setup

1. Run the backend on `http://localhost:8080` (see the backend README). For UI work without Firebase:
   `DATABASE_DRIVER=memory BOOTSTRAP_ADMIN_USERNAME=admin BOOTSTRAP_ADMIN_PASSWORD='a-long-dev-passphrase' go run ./cmd/api`
2. The backend's `FRONTEND_URL` env var **must contain your dashboard origin** (default `http://localhost:5173`). Several origins can be listed, comma-separated. Requests from other origins are rejected by CORS and CSRF checks.
3. Frontend env:
   ```env
   VITE_API_URL=http://localhost:8080
   ```

### Recommended: proxy the API through the dev server (same origin)
```ts
// vite.config.ts
export default defineConfig({
  server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } },
});
```
Then call relative URLs (`/api/v1/...`) and set `VITE_API_URL=` (empty).

### Production cookie rules
- **Best:** serve the dashboard and the API on the **same site**. Either use subdomains of one domain (`app.example.com` + `api.example.com`) or proxy `/api` through the dashboard host. Backend: `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`.
- If they must be on different sites, the backend needs `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true`. Some browsers (Safari) may still block such third-party cookies, so prefer the same-site setup.
- **Never** read or store the session token. It is HTTP-only, and JavaScript cannot see it. Keep the CSRF token in memory (React state/store), never in `localStorage`.

---

## 2. HTTP client (copy this into the frontend)

```ts
// src/lib/api/client.ts
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const BASE = `${API_URL}/api/v1`;
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface FieldError { field: string; message: string }
export interface PageMeta { page: number; pageSize: number; totalItems: number; totalPages: number; hasNext: boolean }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
    readonly requestId?: string,
    readonly retryAfter?: number,
  ) { super(message); this.name = 'ApiError'; }
  /** { "guestDetails[1].name": "is required", ... } — handy for form libraries */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map(d => [d.field, d.message]));
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

let csrfToken: string | null = null;            // in memory only
export const setCsrfToken = (t: string | null) => { csrfToken = t; };

// Hook these up to your router/store.
export const authEvents = {
  onUnauthorized: () => {},                     // 401 → go to /login
  onPasswordChangeRequired: () => {},           // 403 PASSWORD_CHANGE_REQUIRED → go to /setup-password
};

export function buildUrl(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ''}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  const ra = res.headers.get('Retry-After');
  return new ApiError(res.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? res.statusText,
    body?.error?.details ?? [], body?.requestId ?? res.headers.get('X-Request-ID') ?? undefined, ra ? Number(ra) : undefined);
}

export async function send<T>(method: string, path: string, opts: { body?: unknown; query?: Query; silent?: boolean; retried?: boolean } = {})
  : Promise<{ data: T; meta?: PageMeta }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (UNSAFE.has(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const res = await fetch(buildUrl(path, opts.query), {
    method, headers, credentials: 'include',
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.ok) {
    const json = await res.json();
    return { data: json.data as T, meta: json.meta };
  }
  const err = await toApiError(res);
  // Stale CSRF token (session rotated in another tab) → refresh once and retry.
  if (err.code === 'CSRF_INVALID' && UNSAFE.has(method) && !opts.retried) {
    try {
      const me = await send<{ csrfToken: string }>('GET', '/auth/me', { silent: true });
      csrfToken = me.data.csrfToken;
      return send<T>(method, path, { ...opts, retried: true });
    } catch { /* fall through */ }
  }
  if (!opts.silent) {
    if (err.status === 401) { csrfToken = null; authEvents.onUnauthorized(); }
    else if (err.code === 'PASSWORD_CHANGE_REQUIRED') authEvents.onPasswordChangeRequired();
  }
  throw err;
}

export const get = <T>(path: string, query?: Query) => send<T>('GET', path, { query }).then(r => r.data);
export const getPage = <T>(path: string, query?: Query) =>
  send<T[]>('GET', path, { query }).then(r => ({ items: r.data, meta: r.meta as PageMeta }));
export const post = <T>(path: string, body?: unknown) => send<T>('POST', path, { body }).then(r => r.data);
export const put = <T>(path: string, body: unknown) => send<T>('PUT', path, { body }).then(r => r.data);
export const patch = <T>(path: string, body: unknown) => send<T>('PATCH', path, { body }).then(r => r.data);
export const del = <T>(path: string) => send<T>('DELETE', path).then(r => r.data);

/** Downloads an export (CSV/XLSX) using the server-provided filename. */
export async function download(path: string, query?: Query) {
  const res = await fetch(buildUrl(path, query), { credentials: 'include' });
  if (!res.ok) throw await toApiError(res);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const name = /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? 'export';
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

---

## 3. TypeScript types (exact API shapes)

```ts
// src/lib/api/types.ts
export type Role = 'admin' | 'customer';
export type AccountStatus = 'active' | 'disabled' | 'pending_password_setup';
export type AttendanceStatus = 'attending' | 'not_attending';
export type GuestType = 'adult' | 'child' | 'infant';
export type DuplicatePolicy = 'update' | 'reject' | 'allow';
export type IntegrationMode = 'browser' | 'signed';
export type Granularity = 'day' | 'week' | 'month';
export type ExportFormat = 'csv' | 'xlsx';

export interface UserSettings {
  displayName: string;
  timezone: string;               // IANA, e.g. "Asia/Kuala_Lumpur" ("" if unset)
  defaultExportFormat: '' | ExportFormat;
  defaultPageSize: number;        // 0 if unset
}

export interface UserView {
  id: string;
  username: string;
  role: Role;
  accountStatus: AccountStatus;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt?: string;
  websiteIds: string[];
  settings: UserSettings;
  isLocked: boolean;              // temporarily locked after failed logins
  lockedUntil?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}
export interface UserDetail extends UserView { websites: WebsiteView[] }

export interface RsvpSettings {
  acceptingRsvps: boolean;
  rsvpDeadline?: string;          // RFC 3339
  maxGuestsPerRsvp: number;       // default 10
  mealOptions: string[];          // default: standard, vegetarian, vegan, halal, gluten_free, kids, other
  duplicatePolicy: DuplicatePolicy; // default "update" (same phone number overwrites)
  requirePhone: boolean;          // default true
}
export interface WishSettings { acceptingWishes: boolean; autoApprove: boolean }
export interface IntegrationView {
  mode: IntegrationMode;
  allowedOrigins: string[];
  captchaRequired: boolean;
  signingKeyId?: string;
  hasSigningSecret: boolean;      // the secret itself is never returned again
  secretRotatedAt?: string;
}
export interface WebsiteView {
  id: string;
  ownerUserId: string;            // "" = unassigned
  slug: string;
  websiteName: string;
  websiteUrl: string;
  weddingDate?: string;           // YYYY-MM-DD
  timezone: string;
  isActive: boolean;
  rsvpSettings: RsvpSettings;
  wishSettings: WishSettings;
  integration: IntegrationView;
  createdAt: string;
  updatedAt: string;
}

export interface GuestDetail { name: string; type: GuestType }
export interface Rsvp {
  id: string;
  websiteId: string;
  guestName: string;
  phoneNumber: string;
  attendanceStatus: AttendanceStatus;
  numberOfGuests: number;         // total people INCLUDING the main guest
  guestDetails: GuestDetail[] | null; // may be empty/null → treat as []
  mealPreference: string;         // "" when none / declined
  dietaryRequirements: string;
  notes: string;                  // may contain newlines
  source: 'browser' | 'server' | 'dashboard';
  createdAt: string;
  updatedAt: string;
}
export interface Wish {
  id: string;
  websiteId: string;
  senderName: string;
  message: string;                // plain text, may contain newlines — render as text, never as HTML
  isVisible: boolean;
  isFavourite: boolean;
  source: 'browser' | 'server';
  createdAt: string;
  updatedAt: string;
}
export interface AuditLog {
  id: string;
  actorUserId: string;
  actorUsername: string;
  actorRole: Role | '';
  action: string;                 // e.g. "admin.user.create" (see §8.9)
  targetType: 'user' | 'website' | 'rsvp' | 'wish' | 'session' | 'export';
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  requestId: string;
  createdAt: string;
}

// ---- Analytics ----
export interface AttendanceSummary {
  totalSubmissions: number;       // RSVP forms received
  attendingSubmissions: number;
  declinedSubmissions: number;
  attendingGuests: number;        // people attending (sum of numberOfGuests)
  declinedGuests: number;
  expectedAttendees: number;      // = attendingGuests
  totalWishes: number;
  attendancePercentage: number;   // attendingSubmissions / totalSubmissions * 100 (2 dp)
  guestAttendancePercentage: number;
  averageGuestsPerAttendingRsvp: number;
}
export interface AttendanceSplitItem { submissions: number; guests: number; submissionsPercentage: number; guestsPercentage: number }
export interface GuestBreakdown { totalAttendingGuests: number; adults: number; children: number; infants: number; unspecified: number }
export interface BreakdownItem { key: string; submissions: number; guests: number }
export interface TrendPoint {
  period: string;                 // "2026-11-10" | "2026-W46" | "2026-11"
  startDate: string; endDate: string;
  submissions: number; attending: number; declined: number;
  attendingGuests: number; declinedGuests: number; wishes: number;
}
export interface Analytics {
  websiteId?: string;
  from?: string; to?: string;     // only present when a date range was requested
  granularity: Granularity;
  summary: AttendanceSummary;
  attendingVsDeclined: { attending: AttendanceSplitItem; declined: AttendanceSplitItem };
  guestBreakdown: GuestBreakdown;
  mealPreferences: BreakdownItem[];      // keys = meal options + "unspecified"; attending only
  dietaryRequirements: BreakdownItem[];  // keys: none, vegetarian, vegan, halal, gluten_free, nut_allergy,
                                         //       dairy_free, seafood_allergy, egg_allergy, other
  trends: TrendPoint[];
}
export interface TrendsResult { websiteId?: string; granularity: Granularity; from: string; to: string; points: TrendPoint[] }
export interface WebsiteSummary {
  websiteId: string; slug: string; websiteName: string; ownerUserId: string;
  isActive: boolean; weddingDate?: string; summary: AttendanceSummary;
}
export interface GlobalAnalytics extends Analytics { websites: WebsiteSummary[] }

// ---- Dashboards ----
export interface CustomerDashboard {
  user: UserView;
  totals: AttendanceSummary;
  websites: { website: WebsiteView; summary: AttendanceSummary; daysUntilWedding?: number /* negative after the wedding */ }[];
  trends: TrendPoint[];           // last 30 days, daily
}
export interface UserCounts { total: number; admins: number; customers: number; active: number; disabled: number; pendingPasswordSetup: number }
export interface AdminDashboard {
  users: UserCounts;
  websites: { total: number; active: number };
  totals: AttendanceSummary;
  topWebsites: WebsiteSummary[];  // ≤ 10, by submissions
  recentAuditLogs: AuditLog[];    // ≤ 10
  trends: TrendPoint[];           // last 30 days, all websites
}

// ---- Auth / admin results ----
export interface SessionResponse { user: UserView; csrfToken: string; expiresAt: string; mustChangePassword: boolean }
export interface MeResponse { user: UserView; csrfToken: string; sessionExpiresAt: string; mustChangePassword: boolean }
export interface CreateCustomerResult { user: UserView; website: WebsiteView | null /* null when created without one */; temporaryPassword: string; temporaryPasswordExpiresAt: string }
export interface ResetPasswordResult { user: UserView; temporaryPassword: string; temporaryPasswordExpiresAt: string }
export interface SigningSecretResult { websiteId: string; keyId: string; secret: string; rotatedAt: string }
```

---

## 4. Endpoint functions (typed map of the whole API)

```ts
// src/lib/api/endpoints.ts
import { get, getPage, post, put, patch, del, download, setCsrfToken } from './client';
import type * as T from './types';

const enc = encodeURIComponent;
export interface ListQuery {
  page?: number; pageSize?: number; search?: string;
  attendanceStatus?: T.AttendanceStatus; from?: string; to?: string;
  sortBy?: 'createdAt' | 'guestName' | 'numberOfGuests'; sortOrder?: 'asc' | 'desc';
  isVisible?: boolean; isFavourite?: boolean;            // wishes only
}
export interface AnalyticsQuery { from?: string; to?: string; granularity?: T.Granularity }
export interface ExportQuery extends ListQuery { format?: T.ExportFormat; type?: 'all' | 'attending' | 'declined' | 'guests' }

export const auth = {
  login: async (username: string, password: string) => {
    const s = await post<T.SessionResponse>('/auth/login', { username, password }); setCsrfToken(s.csrfToken); return s;
  },
  me: async () => { const s = await get<T.MeResponse>('/auth/me'); setCsrfToken(s.csrfToken); return s; },
  csrf: () => get<{ csrfToken: string }>('/auth/csrf'),
  logout: async () => { try { await post('/auth/logout'); } finally { setCsrfToken(null); } },
  logoutAll: async () => { try { return await post<{ sessionsRevoked: number }>('/auth/logout-all'); } finally { setCsrfToken(null); } },
  setupPassword: async (newPassword: string, confirmPassword: string) => {
    const s = await post<T.SessionResponse>('/auth/password/setup', { newPassword, confirmPassword }); setCsrfToken(s.csrfToken); return s;
  },
  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    const s = await post<T.SessionResponse>('/auth/password/change', { currentPassword, newPassword, confirmPassword });
    setCsrfToken(s.csrfToken); return s;
  },
};

const site = (id: string) => `/customer/websites/${enc(id)}`;
export const customer = {
  dashboard: () => get<T.CustomerDashboard>('/customer/dashboard'),
  websites: () => get<T.WebsiteView[]>('/customer/websites'),
  website: (id: string) => get<T.WebsiteView>(site(id)),
  updateWebsiteSettings: (id: string, body: { rsvpSettings?: Partial<RsvpSettingsInput>; wishSettings?: Partial<T.WishSettings> }) =>
    put<T.WebsiteView>(`${site(id)}/settings`, body),
  rsvps: (id: string, q?: ListQuery) => getPage<T.Rsvp>(`${site(id)}/rsvps`, q as any),
  rsvp: (id: string, rsvpId: string) => get<T.Rsvp>(`${site(id)}/rsvps/${enc(rsvpId)}`),
  updateRsvp: (id: string, rsvpId: string, body: RsvpInput) => put<T.Rsvp>(`${site(id)}/rsvps/${enc(rsvpId)}`, body),
  deleteRsvp: (id: string, rsvpId: string) => del<{ deleted: true }>(`${site(id)}/rsvps/${enc(rsvpId)}`),
  wishes: (id: string, q?: ListQuery) => getPage<T.Wish>(`${site(id)}/wishes`, q as any),
  wish: (id: string, wishId: string) => get<T.Wish>(`${site(id)}/wishes/${enc(wishId)}`),
  updateWish: (id: string, wishId: string, body: { isVisible?: boolean; isFavourite?: boolean }) =>
    patch<T.Wish>(`${site(id)}/wishes/${enc(wishId)}`, body),
  deleteWish: (id: string, wishId: string) => del<{ deleted: true }>(`${site(id)}/wishes/${enc(wishId)}`),
  analytics: (id: string, q?: AnalyticsQuery) => get<T.Analytics>(`${site(id)}/analytics`, q as any),
  trends: (id: string, q?: AnalyticsQuery) => get<T.TrendsResult>(`${site(id)}/analytics/trends`, q as any),
  exportRsvps: (id: string, q?: ExportQuery) => download(`${site(id)}/export/rsvps`, q as any),
  exportWishes: (id: string, q?: ExportQuery) => download(`${site(id)}/export/wishes`, q as any),
  exportAttendance: (id: string, q?: ExportQuery) => download(`${site(id)}/export/attendance`, q as any),
  settings: () => get<T.UserView>('/customer/settings'),
  updateSettings: (body: Partial<{ displayName: string; timezone: string; defaultExportFormat: T.ExportFormat; defaultPageSize: number }>) =>
    put<T.UserView>('/customer/settings', body),
};

export const admin = {
  dashboard: () => get<T.AdminDashboard>('/admin/dashboard'),
  users: (q?: { page?: number; pageSize?: number; role?: T.Role; accountStatus?: T.AccountStatus; search?: string }) =>
    getPage<T.UserView>('/admin/users', q as any),
  createCustomer: (body: { username: string; displayName?: string; websiteName?: string; websiteSlug?: string;
                           websiteUrl?: string; weddingDate?: string; timezone?: string }) =>
    post<T.CreateCustomerResult>('/admin/users', body),
  user: (id: string) => get<T.UserDetail>(`/admin/users/${enc(id)}`),
  updateUser: (id: string, body: { username?: string; displayName?: string; websiteIds?: string[] }) =>
    put<T.UserDetail>(`/admin/users/${enc(id)}`, body),
  resetPassword: (id: string) => post<T.ResetPasswordResult>(`/admin/users/${enc(id)}/reset-password`),
  disableUser: (id: string) => post<T.UserView>(`/admin/users/${enc(id)}/disable`),
  activateUser: (id: string) => post<T.UserView>(`/admin/users/${enc(id)}/activate`),
  revokeSessions: (id: string) => post<{ sessionsRevoked: number }>(`/admin/users/${enc(id)}/revoke-sessions`),
  websites: (q?: { page?: number; pageSize?: number; ownerUserId?: string; isActive?: boolean; search?: string }) =>
    getPage<T.WebsiteView>('/admin/websites', q as any),
  createWebsite: (body: { websiteName: string; slug: string; websiteUrl: string; ownerUserId?: string;
                          weddingDate?: string; timezone?: string; isActive?: boolean }) =>
    post<T.WebsiteView>('/admin/websites', body),
  website: (id: string) => get<T.WebsiteView>(`/admin/websites/${enc(id)}`),
  updateWebsite: (id: string, body: AdminWebsiteUpdate) => put<T.WebsiteView>(`/admin/websites/${enc(id)}`, body),
  rotateSigningSecret: (id: string) => post<T.SigningSecretResult>(`/admin/websites/${enc(id)}/integration/secret`),
  recomputeStats: (id: string) => post<T.AttendanceSummary>(`/admin/websites/${enc(id)}/analytics/recompute`),
  rsvps: (q?: ListQuery & { websiteId?: string }) => getPage<T.Rsvp>('/admin/rsvps', q as any),
  wishes: (q?: ListQuery & { websiteId?: string }) => getPage<T.Wish>('/admin/wishes', q as any),
  analytics: (q?: AnalyticsQuery & { websiteId?: string }) => get<T.GlobalAnalytics>('/admin/analytics', q as any),
  auditLogs: (q?: { page?: number; pageSize?: number; actorUserId?: string; action?: string; targetType?: string;
                    targetId?: string; from?: string; to?: string }) => getPage<T.AuditLog>('/admin/audit-logs', q as any),
  exportRsvps: (q?: ExportQuery & { websiteId?: string }) => download('/admin/export/rsvps', q as any),
  exportWishes: (q?: ExportQuery & { websiteId?: string }) => download('/admin/export/wishes', q as any),
};

// ---- Request bodies ----
export interface RsvpInput {               // full replacement on PUT
  guestName: string;
  phoneNumber?: string;
  attendanceStatus: T.AttendanceStatus;
  numberOfGuests?: number;                // defaults to guestDetails.length or 1
  guestDetails?: { name: string; type?: T.GuestType }[]; // length must equal numberOfGuests
  mealPreference?: string;                // must be one of the website's mealOptions
  dietaryRequirements?: string;
  notes?: string;
}
export interface RsvpSettingsInput {
  acceptingRsvps: boolean;
  rsvpDeadline: string;                   // RFC 3339, "" clears it
  maxGuestsPerRsvp: number;               // 1–50
  mealOptions: string[];                  // 1–30 items, lowercase a-z 0-9 _ (max 40 chars each)
  duplicatePolicy: T.DuplicatePolicy;
  requirePhone: boolean;
}
export interface AdminWebsiteUpdate {
  websiteName?: string; slug?: string; websiteUrl?: string; weddingDate?: string /* "" clears */;
  timezone?: string; isActive?: boolean; ownerUserId?: string /* "" unassigns */;
  rsvpSettings?: Partial<RsvpSettingsInput>;
  wishSettings?: Partial<T.WishSettings>;
  integration?: { mode?: T.IntegrationMode; allowedOrigins?: string[]; captchaRequired?: boolean };
}
```

> Request bodies are decoded **strictly**: any unknown field → `422 VALIDATION_ERROR`. Send only the fields listed.

---

## 5. Authentication flow (implement exactly)

### 5.1 App start
1. Call `auth.me()`.
   - `401` → show **Login**.
   - `mustChangePassword: true` → show **Set your password** (only this screen + logout are usable).
   - Otherwise route by `user.role`: `admin` → admin area, `customer` → customer area.

### 5.2 Login screen
- `POST /auth/login { username, password }` → `SessionResponse`. Keep `csrfToken` in memory (the client does this).
- If `mustChangePassword` → go to **Set your password**.
- Error handling:

| Code | Message to show |
|---|---|
| `INVALID_CREDENTIALS` (401) | "Incorrect username or password." (same for unknown user — don't distinguish) |
| `TEMP_PASSWORD_EXPIRED` (401) | "Your temporary password expired. Ask the administrator to reset it." |
| `ACCOUNT_DISABLED` (403) | "This account has been disabled." |
| `ACCOUNT_LOCKED` (429) | "Too many failed attempts. Try again in 15 minutes." |
| `RATE_LIMITED` (429) | "Too many attempts. Try again in {Retry-After} seconds." |
| `CSRF_INVALID` (403) | Dashboard origin not in backend `FRONTEND_URL` (a config issue) |

### 5.3 First login: "Set your password" (temporary password)
- Customers (and bootstrap admins) receive an **8-word temporary password** such as `abacus-ladder-mosaic-velvet-…`, valid for **7 days**.
- After logging in with it, the session is **restricted** (30 minutes). All dashboard APIs return `403 PASSWORD_CHANGE_REQUIRED`. Allowed: `/auth/me`, `/auth/csrf`, `/auth/logout`, `/auth/password/setup`.
- `POST /auth/password/setup { newPassword, confirmPassword }` → new `SessionResponse` (new cookie and **new csrfToken**). Then route to the dashboard.
- On success the backend revokes the temporary credential and all old sessions.

### 5.4 Password policy (validate client-side too; the server is authoritative)
- 8–128 characters
- at least 5 different characters
- must not contain the username (case-insensitive)
- not a common password; no leading/trailing spaces
- setup: must differ from the temporary password. Change: must differ from the current password.
- `confirmPassword` must equal `newPassword`

Errors come back as `422 VALIDATION_ERROR` with `details: [{ field: "newPassword", message: "must be at least 8 characters" }, …]`. Show every message under the field.

### 5.5 Other auth actions
- **Change password** (account settings): `POST /auth/password/change { currentPassword, newPassword, confirmPassword }`. Wrong current password → `422` with field `currentPassword`. Success rotates the session (new csrfToken) and logs out other devices.
- **Logout:** `POST /auth/logout`. **Log out of all devices:** `POST /auth/logout-all` (then go to login).
- **Session lifetime:** 24 h absolute (configurable). On any `401`, clear state and go to login.

---

## 6. Roles, routing and permissions

| Area | Who | Notes |
|---|---|---|
| `/login`, `/setup-password` | anyone | |
| Customer area (`/customer/*` APIs) | `customer` **and** `admin` | Customers see only their own websites. A website they don't own returns **404** (not 403). |
| Admin area (`/admin/*` APIs) | `admin` only | Customers get `403 FORBIDDEN` |

- Admins can call every website-scoped customer endpoint for **any** website. You can **reuse the customer website pages inside the admin area** (e.g. admin → Websites → open → same RSVP/wishes/analytics components).
- Never send user ids or website ids expecting the backend to trust them for permissions. The backend derives permissions from the session, so a 404 just means "not yours / not found".
- A customer can own several websites → the customer UI needs a **website switcher** (from `GET /customer/websites`).

---

## 7. Customer area — screens and endpoints

### 7.1 Overview (`GET /customer/dashboard`)
- Stat cards from `totals`: **RSVP forms received** (`totalSubmissions`), **Attending forms** / **Declined forms**, **Guests attending** (`attendingGuests`), **Guests declined**, **Attendance %** (`attendancePercentage`), **Wishes** (`totalWishes`).
- One card per website: name, slug, wedding date, `daysUntilWedding` (countdown; negative = past), its `summary`.
- Line/bar chart of `trends` (last 30 days: `submissions`, `attendingGuests`).
- ⚠️ Always label **forms/submissions** and **guests** differently: one RSVP can bring several guests.

### 7.2 Guest list / RSVPs (`GET /customer/websites/:id/rsvps`)
Table columns: guest name, phone, status, number of guests, meal, dietary, notes, submitted at. Row click → detail (`GET …/rsvps/:rsvpId`) showing `guestDetails` (name + adult/child/infant).

List controls (query params):

| Param | UI | Rules |
|---|---|---|
| `page`, `pageSize` | pagination | pageSize 1–100 (default 20). Use `meta.totalItems/totalPages/hasNext`. |
| `search` | search box | Name: min 2 letters (multi-word OK, e.g. "binti ali"); phone: min 3 digits (prefix match). Debounce ~300 ms. |
| `attendanceStatus` | tabs: All / Attending / Declined | `attending` \| `not_attending` |
| `from`, `to` | date range picker | `YYYY-MM-DD`, interpreted in the **website's timezone**; `to` includes the whole day |
| `sortBy` + `sortOrder` | column sort | `createdAt` (default, desc), `guestName`, `numberOfGuests` |

⚠️ **Date filters can only be combined with `sortBy=createdAt`.** Disable the other sorts while a date range is active, otherwise you get `422`.

- **Edit RSVP:** `PUT …/rsvps/:rsvpId` with the full `RsvpInput` (it replaces the whole RSVP). Rules: `numberOfGuests` 1–`maxGuestsPerRsvp`; if `guestDetails` is sent, its length must equal `numberOfGuests`; `mealPreference` must be in the website's `mealOptions`; for `not_attending` the meal is cleared. Counters and analytics update automatically.
- **Delete RSVP:** `DELETE …/rsvps/:rsvpId` (confirm dialog). Analytics update automatically.

### 7.3 Wishes (`GET /customer/websites/:id/wishes`)
- Filters: `search` (sender name), `isVisible`, `isFavourite`, `from`, `to`, `sortOrder` (newest first by default), pagination.
- Actions: toggle **Show on website** (`isVisible`) and **Favourite** (`isFavourite`) via `PATCH …/wishes/:wishId`; delete via `DELETE`.
- If the website has `wishSettings.autoApprove = false`, new wishes arrive hidden → show a "Pending approval" filter (`isVisible=false`).
- Render `message` as plain text (React's default escaping; never `dangerouslySetInnerHTML`). Preserve line breaks with `white-space: pre-wrap`.

### 7.4 Analytics (`GET /customer/websites/:id/analytics?from=&to=&granularity=`)
- Without `from`/`to`: `summary` = all time; `trends` = last 30 days / 12 weeks / 12 months by granularity.
- With `from`/`to` (`YYYY-MM-DD`, max 1100 days): everything is limited to that range.
- Suggested widgets:
  - KPI cards from `summary` (see §7.1)
  - Donut: `attendingVsDeclined` (toggle between submissions and guests)
  - Stacked bar: `guestBreakdown` (adults / children / infants / unspecified)
  - Bar: `mealPreferences` (use `guests` for catering counts). Key `unspecified` = attending RSVPs without a meal choice.
  - Bar: `dietaryRequirements` (categories detected from free text: `none`, `vegetarian`, `vegan`, `halal`, `gluten_free`, `nut_allergy`, `dairy_free`, `seafood_allergy`, `egg_allergy`, `other`; one RSVP can be in several)
  - Trend chart with Day/Week/Month switch: `trends[].period` labels (`2026-11-10`, `2026-W46`, `2026-11`)
- `GET …/analytics/trends` returns only the trend series (`points`) if you want a separate chart request.
- `granularity` other than day/week/month, or `from` after `to` → `422`.

### 7.5 Exports (file downloads)
Use `download()` from the client (shows errors properly). Formats: `format=xlsx` (default) or `csv`.

| Button | Call |
|---|---|
| Full guest list | `customer.exportRsvps(id, { format, type: 'all', ...currentFilters })` |
| Confirmed attendees | `type: 'attending'` |
| Declined | `type: 'declined'` |
| Guest details (one row per person) | `type: 'guests'` |
| Wedding wishes | `customer.exportWishes(id, { format, ...wishFilters })` |
| Attendance report | `customer.exportAttendance(id, { format, from, to, search, attendanceStatus })`. XLSX has 4 sheets: RSVP Summary, RSVP List, Guest Details, Wedding Wishes. |

Exports respect the current search/status/date filters (pass them through). The limit is 50,000 rows → `422` asks the user to narrow the filters. Values that look like spreadsheet formulas are prefixed with `'` on purpose (security).

### 7.6 Website settings (`PUT /customer/websites/:id/settings`)
Customers can change only:
```json
{ "rsvpSettings": { "acceptingRsvps": true, "rsvpDeadline": "2026-12-01T23:59:59+08:00", "maxGuestsPerRsvp": 6,
                    "mealOptions": ["chicken", "fish", "vegetarian"], "duplicatePolicy": "update", "requirePhone": true },
  "wishSettings": { "acceptingWishes": true, "autoApprove": false } }
```
- All fields optional; send only what changed. `rsvpDeadline: ""` removes the deadline.
- Show the slug, URL, wedding date and integration settings as **read-only** (admin-only fields; sending them → `422`).
- Duplicate policy help text: **update** = a guest resubmitting with the same phone number replaces their RSVP; **reject** = second submission refused; **allow** = every submission kept.

### 7.7 Account settings (`GET/PUT /customer/settings`)
Fields: `displayName` (≤100), `timezone` (IANA name; invalid → 422), `defaultExportFormat` (`csv`/`xlsx`), `defaultPageSize` (5–100). Plus the change-password form (§5.5) and "Log out of all devices".

---

## 8. Admin area — screens and endpoints

### 8.1 Admin overview (`GET /admin/dashboard`)
User counts (total, customers, admins, active, disabled, pending setup), website counts (total/active), global `totals`, `topWebsites` table, `recentAuditLogs`, 30-day `trends`.

### 8.2 Users list (`GET /admin/users`)
Filters: `role`, `accountStatus`, `search` (username prefix), pagination. Badges: status, `mustChangePassword`, `isLocked`.

### 8.3 Create customer (`POST /admin/users`)
Form → creates the customer and, optionally, their first website in one step:

| Field | Rules |
|---|---|
| `username` | required, 3–32 chars, letters/digits/`.`/`_`/`-`, must start with a letter or digit; unique (case-insensitive) |
| `displayName` | optional, ≤ 100 |
| `websiteName` | required with a website, ≤ 150 |
| `websiteSlug` | required with a website, 3–63 chars, lowercase letters/digits and single hyphens (`ahmad-sarah`); unique; reserved: api, admin, www, public, static, assets, dashboard |
| `websiteUrl` | required with a website, absolute `http(s)://` URL |
| `weddingDate` | optional `YYYY-MM-DD`; only allowed with a website |
| `timezone` | optional IANA timezone (defaults to server default) |

The website fields are all-or-nothing: send name, slug and URL together, or omit all three (and `weddingDate`) to create the account only. Partial details return `422` on each missing field. Without a website the response has `website: null`; assign one later from the website's owner field or the customer's Edit dialog.

Response contains **`temporaryPassword`, shown only once.** Show a modal with the username and password, a **Copy** button, the expiry (`temporaryPasswordExpiresAt`, 7 days) and a warning that it can't be shown again. Errors: `409 USERNAME_TAKEN`, `409 SLUG_TAKEN`, `422` field errors.

### 8.4 User detail (`GET /admin/users/:id`)
Shows the user plus `websites`. Actions:
- **Edit** (`PUT /admin/users/:id`): `username`, `displayName`, `websiteIds` (**replaces** the full list of websites owned; websites are moved from other owners; unlisted ones become unassigned; only for customers). `409 USERNAME_TAKEN`; unknown website → `422`.
- **Reset password** (`POST …/reset-password`): returns a new one-time `temporaryPassword` (same once-only modal). Logs the user out everywhere. Not allowed on yourself.
- **Disable** (`POST …/disable`) / **Activate** (`POST …/activate`). Disable logs the user out immediately. Not allowed on yourself.
- **Revoke sessions** (`POST …/revoke-sessions`): force logout.

### 8.5 Websites list / create (`GET`, `POST /admin/websites`)
Filters: `ownerUserId`, `isActive`, `search` (slug prefix). Create body: `websiteName`, `slug`, `websiteUrl`, optional `ownerUserId` (must be a customer), `weddingDate`, `timezone`, `isActive`.

### 8.6 Website detail / edit (`GET`, `PUT /admin/websites/:id`)
Editable: name, **slug**, URL, wedding date, timezone, active flag, owner, `rsvpSettings`, `wishSettings`, and **integration**:
- `integration.mode`: `browser` (wedding website calls the API directly from the browser) or `signed` (only server-to-server signed requests).
- `integration.allowedOrigins`: e.g. `["https://ahmad-sarah.com", "https://www.ahmad-sarah.com"]`. If not empty, browser submissions from other origins are rejected (`ORIGIN_NOT_ALLOWED`).
- `integration.captchaRequired`: only possible if the server has a CAPTCHA provider configured (otherwise `422`).

⚠️ **Changing the slug breaks the wedding website until it is updated** (the old slug stops working immediately). Show a confirmation dialog.
- `isActive: false` makes the public site's RSVP/wish forms fail with `WEBSITE_INACTIVE`.

Extra actions:
- **Rotate signing secret** (`POST …/integration/secret`) → `{ keyId, secret }` **shown once** (same once-only modal). Only needed for `signed` mode / server-side integrations.
- **Recompute statistics** (`POST …/analytics/recompute`) → repairs the aggregate counters; returns the new summary.
- Link to the website's RSVPs/wishes/analytics/exports using the **customer endpoints** with this website id.

### 8.7 All RSVPs / all wishes (`GET /admin/rsvps`, `GET /admin/wishes`)
Same filters as the customer lists, plus optional `websiteId` (website dropdown). Without it, results span every website (each row has `websiteId`; map it to the slug using the websites list).

### 8.8 Global analytics (`GET /admin/analytics`)
Same shape as website analytics plus `websites: WebsiteSummary[]` (per-website table sorted by submissions). Optional `websiteId`, `from`, `to`, `granularity`.

### 8.9 Audit logs (`GET /admin/audit-logs`)
Filters: `actorUserId`, `action`, `targetType`, `targetId`, `from`, `to`, pagination (newest first). Action values:
`auth.login.success`, `auth.login.failed`, `auth.login.locked`, `auth.logout`, `auth.logout_all`, `auth.password.setup`, `auth.password.change`, `admin.bootstrap`, `admin.user.create`, `admin.user.update`, `admin.user.reset_password`, `admin.user.disable`, `admin.user.activate`, `admin.user.revoke_sessions`, `admin.user.assign_websites`, `admin.website.create`, `admin.website.update`, `admin.website.slug_change`, `admin.website.owner_change`, `admin.website.rotate_secret`, `admin.website.recompute_stats`, `website.settings.update`, `rsvp.update`, `rsvp.delete`, `wish.update`, `wish.delete`, `data.export`, `user.settings.update`.
Show `metadata` as a small key/value list.

### 8.10 Global exports
`admin.exportRsvps({ format, type, websiteId?, ...filters })`, `admin.exportWishes({ format, websiteId?, ...filters })`. Without `websiteId`, the first column is the website slug.

---

## 9. Errors — global handling

Every error: `{ success: false, error: { code, message, details? }, requestId }`. Show `message` to users and log `requestId` (support can trace it in the server logs).

| HTTP | Code | Frontend behaviour |
|---|---|---|
| 400 | `BAD_REQUEST` | Toast with message |
| 401 | `UNAUTHORIZED` | Clear state → login ("Your session has expired") |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Route to set-password screen |
| 403 | `FORBIDDEN` | "You don't have access" page |
| 403 | `CSRF_INVALID` | Client refreshes the token and retries once; if it persists → re-login |
| 404 | `NOT_FOUND` | Not-found state (also for websites the user doesn't own) |
| 409 | `USERNAME_TAKEN` / `SLUG_TAKEN` / `CONFLICT` | Show on the relevant field |
| 413 | `PAYLOAD_TOO_LARGE` | "Too much data" |
| 422 | `VALIDATION_ERROR` | Map `details[].field` → form fields (paths like `rsvpSettings.mealOptions`, `guestDetails[1].name`) |
| 429 | `RATE_LIMITED` / `ACCOUNT_LOCKED` | Show wait time from `Retry-After` |
| 500 | `INTERNAL_ERROR` | Generic error + `requestId` |
| 503 | `SERVICE_UNAVAILABLE` | "Service temporarily unavailable, retry" |

---

## 10. UX rules and gotchas

1. **Submissions ≠ guests.** Label "RSVP forms" vs "Guests" everywhere. `attendancePercentage` is by forms; `guestAttendancePercentage` is by people.
2. **One-time secrets** (temporary passwords, signing secrets) appear only in the create/reset/rotate response. Don't cache them and don't put them in URLs or logs; show them once with a copy button.
3. **Timezones:** timestamps are UTC → display in the website's `timezone` (or the user's `settings.timezone`). Date filters (`from`/`to`) are interpreted in the website timezone.
4. **Strict bodies:** send only documented fields. Extra keys → 422.
5. **Refetch after mutations:** analytics/counters update immediately on RSVP edit/delete. Invalidate dashboard/analytics queries (e.g. with TanStack Query).
6. **Website switcher:** customers can own multiple websites; persist the selected website id in the URL (`/w/:websiteId/...`).
7. **Wishes are plain text:** never render as HTML.
8. **Pagination:** use `meta` from list responses; pages beyond the end return an empty list.
9. **Search:** min 2 letters / 3 digits; shorter input → don't call the API (it returns 422).
10. **Don't** implement email/forgot-password flows; show "Contact your administrator" instead.

---

## 11. Sample responses

**Login (`POST /auth/login`)**
```json
{ "success": true, "data": {
  "user": { "id": "c8bde5d33c5040d3b0bd", "username": "ahmad", "role": "customer", "accountStatus": "pending_password_setup",
            "mustChangePassword": true, "temporaryPasswordExpiresAt": "2026-11-17T08:54:22Z", "websiteIds": ["e939176587b346d9ab67"],
            "settings": { "displayName": "", "timezone": "Asia/Kuala_Lumpur", "defaultExportFormat": "xlsx", "defaultPageSize": 20 },
            "isLocked": false, "createdAt": "2026-11-10T08:54:22Z", "updatedAt": "2026-11-10T08:54:22Z" },
  "csrfToken": "q3v…", "expiresAt": "2026-11-10T09:24:22Z", "mustChangePassword": true } }
```

**RSVP list (`GET /customer/websites/:id/rsvps?page=1&pageSize=20`)**
```json
{ "success": true,
  "data": [ { "id": "5ee4a6f9746243f9af5a", "websiteId": "e939176587b346d9ab67", "guestName": "Ahmad", "phoneNumber": "60123456789",
              "attendanceStatus": "attending", "numberOfGuests": 3,
              "guestDetails": [ { "name": "Ahmad", "type": "adult" }, { "name": "Guest 2", "type": "adult" }, { "name": "Guest 3", "type": "child" } ],
              "mealPreference": "standard", "dietaryRequirements": "No peanuts", "notes": "Arriving early", "source": "browser",
              "createdAt": "2026-11-10T08:54:22Z", "updatedAt": "2026-11-10T08:54:22Z" } ],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1, "hasNext": false } }
```

**Validation error**
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "request validation failed",
  "details": [ { "field": "newPassword", "message": "must be at least 8 characters" },
               { "field": "newPassword", "message": "must not contain your username" } ] },
  "requestId": "ESGqrB-y-s3z3bhA" }
```

For every remaining endpoint see `API_ENDPOINTS.md` in the backend repository, or Swagger UI at `{API_URL}/api/docs`.
