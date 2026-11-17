/**
 * DEVELOPMENT-ONLY in-memory mock of the Wedding Project REST API, installed as an Axios adapter.
 * Enabled only by `npm run dev:mock` (VITE_USE_MOCKS=true in a DEV build). It mirrors the documented
 * contract (envelopes, CSRF, restricted sessions, validation rules, pagination, exports) so the UI can
 * be developed without the Go backend. It is never used in production builds.
 */
import { AxiosError, AxiosHeaders, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { computeAnalytics, inRange, summarize } from './analytics';
import { createDb, newId, nowIso, tempPassword, type MockDb } from './db';
import type {
  AuditLog,
  FieldError,
  Rsvp,
  UserView,
  WebsiteView,
  Wish,
} from '@/types/api';

type Q = Record<string, string | undefined>;
interface Ctx {
  params: Record<string, string>;
  query: Q;
  body: Record<string, unknown>;
  user: UserView | null;
  restricted: boolean;
}
interface MockResult {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}
type Handler = (ctx: Ctx) => MockResult;

const db: MockDb = createDb();
const SESSION_KEY = 'wp.mock.session'; // mock-only: which seeded user is "signed in"
let csrf = Math.random().toString(36).slice(2);

const ok = (data: unknown, meta?: unknown): MockResult => ({ status: 200, data: { success: true, data, ...(meta ? { meta } : {}) } });
const fail = (status: number, code: string, message: string, details?: FieldError[]): MockResult => ({
  status,
  data: { success: false, error: { code, message, ...(details ? { details } : {}) }, requestId: Math.random().toString(36).slice(2, 18) },
});
const validation = (details: FieldError[]) => fail(422, 'VALIDATION_ERROR', 'request validation failed', details);

function session(): { user: UserView; restricted: boolean } | null {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    const user = db.users.find((u) => u.id === id);
    if (!user || user.accountStatus === 'disabled') return null;
    return { user, restricted: user.mustChangePassword };
  } catch {
    return null;
  }
}
function setSession(userId: string | null) {
  try {
    if (userId) sessionStorage.setItem(SESSION_KEY, userId);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  csrf = Math.random().toString(36).slice(2);
}
const expiresAt = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

function audit(user: UserView | null, action: string, targetType: AuditLog['targetType'], targetId: string, metadata: Record<string, unknown> = {}) {
  db.auditLogs.unshift({
    id: newId(),
    actorUserId: user?.id ?? '',
    actorUsername: user?.username ?? '',
    actorRole: user?.role ?? '',
    action,
    targetType,
    targetId,
    metadata,
    ipAddress: '127.0.0.1',
    requestId: Math.random().toString(36).slice(2, 18),
    createdAt: nowIso(),
  });
}

function paginate<T>(items: T[], q: Q) {
  const page = Math.max(Number(q.page ?? 1) || 1, 1);
  const pageSize = Math.min(Math.max(Number(q.pageSize ?? 20) || 20, 1), 100);
  const totalItems = items.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const slice = items.slice((page - 1) * pageSize, page * pageSize);
  return ok(slice, { page, pageSize, totalItems, totalPages, hasNext: page < totalPages });
}

function checkPassword(pwd: string, confirm: string, username: string, previous?: string): FieldError[] {
  const errs: FieldError[] = [];
  if (pwd.length < 8) errs.push({ field: 'newPassword', message: 'must be at least 8 characters' });
  if (new Set(pwd).size < 5) errs.push({ field: 'newPassword', message: 'must contain at least 5 different characters' });
  if (pwd.toLowerCase().includes(username.toLowerCase())) errs.push({ field: 'newPassword', message: 'must not contain your username' });
  if (previous && pwd === previous) errs.push({ field: 'newPassword', message: 'must differ from your current password' });
  if (pwd !== confirm) errs.push({ field: 'confirmPassword', message: 'must match the new password' });
  return errs;
}

// ---- list filtering (mirrors backend rules) ----
function filterRsvps(items: Rsvp[], q: Q): Rsvp[] | MockResult {
  const search = q.search?.trim();
  let out = items;
  if (search) {
    if (/^\d+$/.test(search)) {
      if (search.length < 3) return validation([{ field: 'search', message: 'phone search needs at least 3 digits' }]);
      out = out.filter((r) => r.phoneNumber.startsWith(search));
    } else {
      if (search.replace(/[^\p{L}]/gu, '').length < 2) return validation([{ field: 'search', message: 'name search needs at least 2 letters' }]);
      const words = search.toLowerCase().split(/\s+/);
      out = out.filter((r) => words.every((w) => r.guestName.toLowerCase().includes(w)));
    }
  }
  if (q.attendanceStatus) out = out.filter((r) => r.attendanceStatus === q.attendanceStatus);
  if ((q.from || q.to) && q.sortBy && q.sortBy !== 'createdAt')
    return validation([{ field: 'sortBy', message: 'date filters can only be combined with sortBy=createdAt' }]);
  if (q.from || q.to) out = out.filter((r) => inRange(r.createdAt, q.from, q.to));
  const sortBy = (q.sortBy ?? 'createdAt') as keyof Rsvp;
  const dir = (q.sortOrder ?? (sortBy === 'guestName' ? 'asc' : 'desc')) === 'asc' ? 1 : -1;
  return [...out].sort((a, b) => {
    const av = a[sortBy] as string | number;
    const bv = b[sortBy] as string | number;
    return (typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))) * dir;
  });
}

function filterWishes(items: Wish[], q: Q): Wish[] | MockResult {
  let out = items;
  const search = q.search?.trim();
  if (search) {
    if (search.replace(/[^\p{L}]/gu, '').length < 2) return validation([{ field: 'search', message: 'name search needs at least 2 letters' }]);
    out = out.filter((w) => w.senderName.toLowerCase().includes(search.toLowerCase()));
  }
  if (q.isVisible !== undefined) out = out.filter((w) => String(w.isVisible) === q.isVisible);
  if (q.isFavourite !== undefined) out = out.filter((w) => String(w.isFavourite) === q.isFavourite);
  if (q.from || q.to) out = out.filter((w) => inRange(w.createdAt, q.from, q.to));
  const dir = q.sortOrder === 'asc' ? 1 : -1;
  return [...out].sort((a, b) => a.createdAt.localeCompare(b.createdAt) * dir);
}

// ---- helpers ----
function ownWebsite(ctx: Ctx): WebsiteView | MockResult {
  const site = db.websites.find((w) => w.id === ctx.params.id);
  if (!site || (ctx.user!.role !== 'admin' && site.ownerUserId !== ctx.user!.id)) return fail(404, 'NOT_FOUND', 'website not found');
  return site;
}
const isResult = (v: unknown): v is MockResult => typeof v === 'object' && v !== null && 'status' in v && 'data' in v && !('id' in v);
const siteRsvps = (id: string) => db.rsvps.filter((r) => r.websiteId === id);
const siteWishes = (id: string) => db.wishes.filter((w) => w.websiteId === id);
const siteSummary = (w: WebsiteView) => summarize(siteRsvps(w.id), siteWishes(w.id));
const websiteSummary = (w: WebsiteView) => ({
  websiteId: w.id,
  slug: w.slug,
  websiteName: w.websiteName,
  ownerUserId: w.ownerUserId,
  isActive: w.isActive,
  weddingDate: w.weddingDate,
  summary: siteSummary(w),
});

function csv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          let s = String(v ?? '');
          if (/^[=+\-@]/.test(s)) s = `'${s}`;
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\r\n');
}
function fileResult(rows: (string | number)[][], base: string, format: string): MockResult {
  // The mock cannot build real XLSX files; it returns CSV content and says so in the filename.
  const filename = format === 'csv' ? `${base}.csv` : `${base}.mock-xlsx.csv`;
  return {
    status: 200,
    data: new Blob(['﻿' + csv(rows)], { type: 'text/csv;charset=utf-8' }),
    headers: { 'content-disposition': `attachment; filename="${filename}"`, 'content-type': 'text/csv' },
  };
}
function rsvpRows(items: Rsvp[], type: string, withSite = false): (string | number)[][] {
  const slug = (id: string) => db.websites.find((w) => w.id === id)?.slug ?? '';
  if (type === 'guests') {
    const rows: (string | number)[][] = [[...(withSite ? ['Website'] : []), 'Guest name', 'Guest type', 'RSVP name', 'Phone', 'Status', 'Meal']];
    for (const r of items) {
      const d = r.guestDetails?.length ? r.guestDetails : [{ name: r.guestName, type: '' }];
      d.forEach((g, i) => rows.push([...(withSite ? [slug(r.websiteId)] : []), g.name, g.type, r.guestName, i === 0 ? r.phoneNumber : '', r.attendanceStatus, r.mealPreference]));
    }
    return rows;
  }
  return [
    [...(withSite ? ['Website'] : []), 'Guest name', 'Phone', 'Status', 'Guests', 'Meal', 'Dietary', 'Notes', 'Submitted at'],
    ...items.map((r) => [...(withSite ? [slug(r.websiteId)] : []), r.guestName, r.phoneNumber, r.attendanceStatus, r.numberOfGuests, r.mealPreference, r.dietaryRequirements, r.notes, r.createdAt]),
  ];
}
function exportRsvps(items: Rsvp[], q: Q, base: string, withSite = false): MockResult {
  const type = q.type ?? 'all';
  const filtered = filterRsvps(items, { ...q, attendanceStatus: type === 'attending' ? 'attending' : type === 'declined' ? 'not_attending' : q.attendanceStatus });
  if (isResult(filtered)) return filtered;
  const suffix = type === 'all' ? 'rsvp' : type === 'guests' ? 'guests' : `rsvp-${type}`;
  return fileResult(rsvpRows(filtered, type, withSite), `${base}-${suffix}`, q.format ?? 'xlsx');
}

const MEAL_RE = /^[a-z0-9_]{1,40}$/;
function applyWebsiteSettings(site: WebsiteView, body: Record<string, unknown>): MockResult | null {
  const rs = body.rsvpSettings as Record<string, unknown> | undefined;
  const ws = body.wishSettings as Record<string, unknown> | undefined;
  if (rs) {
    if (rs.maxGuestsPerRsvp !== undefined && (Number(rs.maxGuestsPerRsvp) < 1 || Number(rs.maxGuestsPerRsvp) > 50))
      return validation([{ field: 'rsvpSettings.maxGuestsPerRsvp', message: 'must be between 1 and 50' }]);
    if (rs.mealOptions && !(rs.mealOptions as string[]).every((m) => MEAL_RE.test(m)))
      return validation([{ field: 'rsvpSettings.mealOptions', message: 'items must be lowercase a-z, 0-9 or _' }]);
    const next = { ...site.rsvpSettings, ...rs } as WebsiteView['rsvpSettings'];
    if (rs.rsvpDeadline === '') delete next.rsvpDeadline;
    site.rsvpSettings = next;
  }
  if (ws) site.wishSettings = { ...site.wishSettings, ...ws } as WebsiteView['wishSettings'];
  site.updatedAt = nowIso();
  return null;
}

// ---- routes ----
const routes: [string, RegExp, Handler, { auth?: boolean; admin?: boolean; allowRestricted?: boolean }?][] = [];
const route = (method: string, path: string, handler: Handler, opts?: { auth?: boolean; admin?: boolean; allowRestricted?: boolean }) =>
  routes.push([method, new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler, { auth: true, ...opts }]);

// Auth
route('POST', '/auth/login', ({ body }) => {
  const user = db.users.find((u) => u.username.toLowerCase() === String(body.username ?? '').toLowerCase());
  if (!user || db.passwords.get(user.id) !== body.password) {
    if (user) audit(user, 'auth.login.failed', 'session', user.id, { reason: 'invalid_credentials' });
    return fail(401, 'INVALID_CREDENTIALS', 'invalid username or password');
  }
  if (user.accountStatus === 'disabled') return fail(403, 'ACCOUNT_DISABLED', 'account disabled');
  setSession(user.id);
  user.lastLoginAt = nowIso();
  audit(user, 'auth.login.success', 'session', user.id);
  return ok({ user, csrfToken: csrf, expiresAt: expiresAt(user.mustChangePassword ? 30 : 24 * 60), mustChangePassword: user.mustChangePassword });
}, { auth: false });
route('GET', '/auth/me', ({ user }) => ok({ user, csrfToken: csrf, sessionExpiresAt: expiresAt(user!.mustChangePassword ? 30 : 24 * 60), mustChangePassword: user!.mustChangePassword }), { allowRestricted: true });
route('GET', '/auth/csrf', () => ok({ csrfToken: csrf }), { allowRestricted: true });
route('POST', '/auth/logout', ({ user }) => {
  audit(user, 'auth.logout', 'session', user!.id);
  setSession(null);
  return ok({ loggedOut: true });
}, { allowRestricted: true });
route('POST', '/auth/logout-all', ({ user }) => {
  audit(user, 'auth.logout_all', 'session', user!.id);
  setSession(null);
  return ok({ sessionsRevoked: 2 });
});
route('POST', '/auth/password/setup', ({ user, body }) => {
  const u = user!;
  const errs = checkPassword(String(body.newPassword ?? ''), String(body.confirmPassword ?? ''), u.username, db.passwords.get(u.id));
  if (errs.length) return validation(errs);
  db.passwords.set(u.id, String(body.newPassword));
  Object.assign(u, { mustChangePassword: false, accountStatus: 'active', temporaryPasswordExpiresAt: undefined, passwordChangedAt: nowIso(), updatedAt: nowIso() });
  setSession(u.id);
  audit(u, 'auth.password.setup', 'user', u.id);
  return ok({ user: u, csrfToken: csrf, expiresAt: expiresAt(24 * 60), mustChangePassword: false });
}, { allowRestricted: true });
route('POST', '/auth/password/change', ({ user, body }) => {
  const u = user!;
  if (db.passwords.get(u.id) !== body.currentPassword) return validation([{ field: 'currentPassword', message: 'is incorrect' }]);
  const errs = checkPassword(String(body.newPassword ?? ''), String(body.confirmPassword ?? ''), u.username, db.passwords.get(u.id));
  if (errs.length) return validation(errs);
  db.passwords.set(u.id, String(body.newPassword));
  u.passwordChangedAt = nowIso();
  setSession(u.id);
  audit(u, 'auth.password.change', 'user', u.id);
  return ok({ user: u, csrfToken: csrf, expiresAt: expiresAt(24 * 60), mustChangePassword: false });
});

// Customer
route('GET', '/customer/dashboard', ({ user }) => {
  const sites = db.websites.filter((w) => w.ownerUserId === user!.id);
  const rs = db.rsvps.filter((r) => sites.some((s) => s.id === r.websiteId));
  const ws = db.wishes.filter((w) => sites.some((s) => s.id === w.websiteId));
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return ok({
    user,
    totals: summarize(rs, ws),
    websites: sites.map((w) => ({
      website: w,
      summary: siteSummary(w),
      daysUntilWedding: w.weddingDate ? Math.round((Date.parse(`${w.weddingDate}T00:00:00Z`) - today) / 86_400_000) : undefined,
    })),
    trends: computeAnalytics(rs, ws, [], { granularity: 'day' }).trends,
  });
});
route('GET', '/customer/websites', ({ user }) => ok(db.websites.filter((w) => w.ownerUserId === user!.id)));
route('GET', '/customer/websites/:id', (ctx) => {
  const s = ownWebsite(ctx);
  return isResult(s) ? s : ok(s);
});
route('PUT', '/customer/websites/:id/settings', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const extra = Object.keys(ctx.body).filter((k) => k !== 'rsvpSettings' && k !== 'wishSettings');
  if (extra.length) return validation(extra.map((field) => ({ field, message: 'unknown field' })));
  const err = applyWebsiteSettings(s, ctx.body);
  if (err) return err;
  audit(ctx.user, 'website.settings.update', 'website', s.id, { fields: Object.keys(ctx.body).join(',') });
  return ok(s);
});
route('GET', '/customer/websites/:id/rsvps', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const list = filterRsvps(siteRsvps(s.id), ctx.query);
  return isResult(list) ? list : paginate(list, ctx.query);
});
route('GET', '/customer/websites/:id/rsvps/:rsvpId', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const r = db.rsvps.find((x) => x.id === ctx.params.rsvpId && x.websiteId === s.id);
  return r ? ok(r) : fail(404, 'NOT_FOUND', 'rsvp not found');
});
route('PUT', '/customer/websites/:id/rsvps/:rsvpId', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const r = db.rsvps.find((x) => x.id === ctx.params.rsvpId && x.websiteId === s.id);
  if (!r) return fail(404, 'NOT_FOUND', 'rsvp not found');
  const b = ctx.body as Partial<Rsvp> & { guestDetails?: Rsvp['guestDetails'] };
  const n = Number(b.numberOfGuests ?? b.guestDetails?.length ?? 1);
  const errs: FieldError[] = [];
  if (!b.guestName) errs.push({ field: 'guestName', message: 'is required' });
  if (n < 1 || n > s.rsvpSettings.maxGuestsPerRsvp) errs.push({ field: 'numberOfGuests', message: `must be between 1 and ${s.rsvpSettings.maxGuestsPerRsvp}` });
  if (b.guestDetails && b.guestDetails.length !== n) errs.push({ field: 'guestDetails', message: 'length must equal numberOfGuests' });
  if (b.mealPreference && !s.rsvpSettings.mealOptions.includes(b.mealPreference)) errs.push({ field: 'mealPreference', message: 'is not a valid meal option' });
  if (errs.length) return validation(errs);
  Object.assign(r, {
    guestName: b.guestName,
    phoneNumber: b.phoneNumber ?? '',
    attendanceStatus: b.attendanceStatus,
    numberOfGuests: n,
    guestDetails: b.guestDetails ?? null,
    mealPreference: b.attendanceStatus === 'attending' ? (b.mealPreference ?? '') : '',
    dietaryRequirements: b.dietaryRequirements ?? '',
    notes: b.notes ?? '',
    updatedAt: nowIso(),
  });
  audit(ctx.user, 'rsvp.update', 'rsvp', r.id, { websiteSlug: s.slug });
  return ok(r);
});
route('DELETE', '/customer/websites/:id/rsvps/:rsvpId', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const i = db.rsvps.findIndex((x) => x.id === ctx.params.rsvpId && x.websiteId === s.id);
  if (i < 0) return fail(404, 'NOT_FOUND', 'rsvp not found');
  db.rsvps.splice(i, 1);
  audit(ctx.user, 'rsvp.delete', 'rsvp', ctx.params.rsvpId!, { websiteSlug: s.slug });
  return ok({ deleted: true });
});
route('GET', '/customer/websites/:id/wishes', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const list = filterWishes(siteWishes(s.id), ctx.query);
  return isResult(list) ? list : paginate(list, ctx.query);
});
route('PATCH', '/customer/websites/:id/wishes/:wishId', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const w = db.wishes.find((x) => x.id === ctx.params.wishId && x.websiteId === s.id);
  if (!w) return fail(404, 'NOT_FOUND', 'wish not found');
  if (typeof ctx.body.isVisible === 'boolean') w.isVisible = ctx.body.isVisible;
  if (typeof ctx.body.isFavourite === 'boolean') w.isFavourite = ctx.body.isFavourite;
  w.updatedAt = nowIso();
  audit(ctx.user, 'wish.update', 'wish', w.id, ctx.body);
  return ok(w);
});
route('DELETE', '/customer/websites/:id/wishes/:wishId', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const i = db.wishes.findIndex((x) => x.id === ctx.params.wishId && x.websiteId === s.id);
  if (i < 0) return fail(404, 'NOT_FOUND', 'wish not found');
  db.wishes.splice(i, 1);
  audit(ctx.user, 'wish.delete', 'wish', ctx.params.wishId!);
  return ok({ deleted: true });
});
route('GET', '/customer/websites/:id/analytics', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const { from, to } = ctx.query;
  if (from && to && from > to) return validation([{ field: 'from', message: 'must be before to' }]);
  return ok(computeAnalytics(siteRsvps(s.id), siteWishes(s.id), s.rsvpSettings.mealOptions, { from, to, granularity: (ctx.query.granularity as 'day') ?? 'day', websiteId: s.id }));
});
route('GET', '/customer/websites/:id/analytics/trends', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const g = (ctx.query.granularity as 'day') ?? 'day';
  const a = computeAnalytics(siteRsvps(s.id), siteWishes(s.id), s.rsvpSettings.mealOptions, { ...ctx.query, granularity: g });
  return ok({ websiteId: s.id, granularity: g, from: a.trends[0]?.startDate ?? '', to: a.trends.at(-1)?.endDate ?? '', points: a.trends });
});
route('GET', '/customer/websites/:id/export/rsvps', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  audit(ctx.user, 'data.export', 'export', s.id, { type: ctx.query.type ?? 'all', format: ctx.query.format ?? 'xlsx' });
  return exportRsvps(siteRsvps(s.id), ctx.query, s.slug);
});
route('GET', '/customer/websites/:id/export/wishes', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const list = filterWishes(siteWishes(s.id), ctx.query);
  if (isResult(list)) return list;
  return fileResult([['Sender', 'Message', 'Visible', 'Favourite', 'Submitted at'], ...list.map((w) => [w.senderName, w.message, String(w.isVisible), String(w.isFavourite), w.createdAt])], `${s.slug}-wishes`, ctx.query.format ?? 'xlsx');
});
route('GET', '/customer/websites/:id/export/attendance', (ctx) => {
  const s = ownWebsite(ctx);
  if (isResult(s)) return s;
  const a = computeAnalytics(siteRsvps(s.id), siteWishes(s.id), s.rsvpSettings.mealOptions, ctx.query);
  return fileResult([['Metric', 'Value'], ...Object.entries(a.summary).map(([k, v]) => [k, v])], `${s.slug}-attendance`, ctx.query.format ?? 'xlsx');
});
route('GET', '/customer/settings', ({ user }) => ok(user));
route('PUT', '/customer/settings', ({ user, body }) => {
  if (body.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: String(body.timezone) });
    } catch {
      return validation([{ field: 'timezone', message: 'is not a valid IANA timezone' }]);
    }
  }
  if (body.defaultPageSize !== undefined && (Number(body.defaultPageSize) < 5 || Number(body.defaultPageSize) > 100))
    return validation([{ field: 'defaultPageSize', message: 'must be between 5 and 100' }]);
  user!.settings = { ...user!.settings, ...(body as Partial<UserView['settings']>) };
  user!.updatedAt = nowIso();
  audit(user, 'user.settings.update', 'user', user!.id, { fields: Object.keys(body).join(',') });
  return ok(user);
});

// Admin
const A = { admin: true };
route('GET', '/admin/dashboard', () => {
  const customers = db.users.filter((u) => u.role === 'customer');
  return ok({
    users: {
      total: db.users.length,
      admins: db.users.length - customers.length,
      customers: customers.length,
      active: db.users.filter((u) => u.accountStatus === 'active').length,
      disabled: db.users.filter((u) => u.accountStatus === 'disabled').length,
      pendingPasswordSetup: db.users.filter((u) => u.accountStatus === 'pending_password_setup').length,
    },
    websites: { total: db.websites.length, active: db.websites.filter((w) => w.isActive).length },
    totals: summarize(db.rsvps, db.wishes),
    topWebsites: db.websites.map(websiteSummary).sort((a, b) => b.summary.totalSubmissions - a.summary.totalSubmissions).slice(0, 10),
    recentAuditLogs: db.auditLogs.slice(0, 10),
    trends: computeAnalytics(db.rsvps, db.wishes, [], { granularity: 'day' }).trends,
  });
}, A);
route('GET', '/admin/users', ({ query }) => {
  let list = [...db.users];
  if (query.role) list = list.filter((u) => u.role === query.role);
  if (query.accountStatus) list = list.filter((u) => u.accountStatus === query.accountStatus);
  if (query.search) list = list.filter((u) => u.username.toLowerCase().startsWith(query.search!.toLowerCase()));
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(list, query);
}, A);
route('POST', '/admin/users', ({ user, body }) => {
  const b = body as Record<string, string>;
  const errs: FieldError[] = [];
  // Website fields are all-or-nothing (like the backend): none of name/slug/URL creates the account only,
  // a partial set is a 422 on each missing field, and weddingDate is only allowed together with a website.
  const withWebsite = Boolean(b.websiteName || b.websiteSlug || b.websiteUrl);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(b.username ?? '')) errs.push({ field: 'username', message: 'must be 3–32 characters (letters, digits, . _ -)' });
  if (withWebsite) {
    for (const f of ['websiteName', 'websiteSlug', 'websiteUrl'] as const) {
      if (!b[f]) errs.push({ field: f, message: 'is required when creating a website' });
    }
    if (b.websiteSlug && (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.websiteSlug) || b.websiteSlug.length < 3)) errs.push({ field: 'websiteSlug', message: 'must be 3–63 lowercase letters, digits and single hyphens' });
    if (b.websiteUrl && !/^https?:\/\/.+/.test(b.websiteUrl)) errs.push({ field: 'websiteUrl', message: 'must be an absolute http(s) URL' });
  } else if (b.weddingDate) {
    errs.push({ field: 'weddingDate', message: 'can only be set together with a website' });
  }
  if (errs.length) return validation(errs);
  if (db.users.some((u) => u.username.toLowerCase() === b.username!.toLowerCase())) return fail(409, 'USERNAME_TAKEN', 'username is already taken');
  if (withWebsite && db.websites.some((w) => w.slug === b.websiteSlug)) return fail(409, 'SLUG_TAKEN', 'slug is already taken');
  const pwd = tempPassword();
  const created = nowIso();
  const u: UserView = {
    id: `u_${newId()}`,
    username: b.username!,
    role: 'customer',
    accountStatus: 'pending_password_setup',
    mustChangePassword: true,
    temporaryPasswordExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    websiteIds: [],
    settings: { displayName: b.displayName ?? '', timezone: b.timezone || 'Asia/Kuala_Lumpur', defaultExportFormat: 'xlsx', defaultPageSize: 20 },
    isLocked: false,
    createdAt: created,
    updatedAt: created,
  };
  db.users.push(u);
  db.passwords.set(u.id, pwd);
  if (!withWebsite) {
    audit(user, 'admin.user.create', 'user', u.id, { username: u.username });
    return ok({ user: u, website: null, temporaryPassword: pwd, temporaryPasswordExpiresAt: u.temporaryPasswordExpiresAt });
  }
  const template = db.websites[0]!;
  const w: WebsiteView = {
    ...structuredClone(template),
    id: `w_${newId()}`,
    ownerUserId: u.id,
    slug: b.websiteSlug!,
    websiteName: b.websiteName!,
    websiteUrl: b.websiteUrl!,
    weddingDate: b.weddingDate || undefined,
    timezone: b.timezone || 'Asia/Kuala_Lumpur',
    isActive: true,
    integration: { mode: 'browser', allowedOrigins: [], captchaRequired: false, hasSigningSecret: false },
    createdAt: created,
    updatedAt: created,
  };
  u.websiteIds = [w.id];
  db.websites.push(w);
  audit(user, 'admin.user.create', 'user', u.id, { username: u.username, websiteSlug: w.slug });
  return ok({ user: u, website: w, temporaryPassword: pwd, temporaryPasswordExpiresAt: u.temporaryPasswordExpiresAt });
}, A);
route('GET', '/admin/users/:id', ({ params }) => {
  const u = db.users.find((x) => x.id === params.id);
  return u ? ok({ ...u, websites: db.websites.filter((w) => w.ownerUserId === u.id) }) : fail(404, 'NOT_FOUND', 'user not found');
}, A);
route('PUT', '/admin/users/:id', ({ user, params, body }) => {
  const u = db.users.find((x) => x.id === params.id);
  if (!u) return fail(404, 'NOT_FOUND', 'user not found');
  const b = body as { username?: string; displayName?: string; websiteIds?: string[] };
  if (b.username && db.users.some((x) => x.id !== u.id && x.username.toLowerCase() === b.username!.toLowerCase())) return fail(409, 'USERNAME_TAKEN', 'username is already taken');
  if (b.username) u.username = b.username;
  if (b.displayName !== undefined) u.settings = { ...u.settings, displayName: b.displayName };
  if (b.websiteIds) {
    const unknown = b.websiteIds.filter((id) => !db.websites.some((w) => w.id === id));
    if (unknown.length) return validation([{ field: 'websiteIds', message: 'contains an unknown website' }]);
    for (const w of db.websites) {
      if (b.websiteIds.includes(w.id)) {
        const prev = db.users.find((x) => x.id === w.ownerUserId);
        if (prev && prev.id !== u.id) prev.websiteIds = prev.websiteIds.filter((id) => id !== w.id);
        w.ownerUserId = u.id;
      } else if (w.ownerUserId === u.id) w.ownerUserId = '';
    }
    u.websiteIds = [...b.websiteIds];
    audit(user, 'admin.user.assign_websites', 'user', u.id, { count: b.websiteIds.length });
  }
  u.updatedAt = nowIso();
  audit(user, 'admin.user.update', 'user', u.id, { username: u.username });
  return ok({ ...u, websites: db.websites.filter((w) => w.ownerUserId === u.id) });
}, A);
route('POST', '/admin/users/:id/reset-password', ({ user, params }) => {
  const u = db.users.find((x) => x.id === params.id);
  if (!u) return fail(404, 'NOT_FOUND', 'user not found');
  if (u.id === user!.id) return fail(400, 'BAD_REQUEST', 'you cannot reset your own password here');
  const pwd = tempPassword();
  db.passwords.set(u.id, pwd);
  Object.assign(u, { mustChangePassword: true, accountStatus: u.accountStatus === 'disabled' ? 'disabled' : 'pending_password_setup', temporaryPasswordExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), updatedAt: nowIso() });
  audit(user, 'admin.user.reset_password', 'user', u.id, { username: u.username });
  return ok({ user: u, temporaryPassword: pwd, temporaryPasswordExpiresAt: u.temporaryPasswordExpiresAt });
}, A);
route('POST', '/admin/users/:id/disable', ({ user, params }) => {
  const u = db.users.find((x) => x.id === params.id);
  if (!u) return fail(404, 'NOT_FOUND', 'user not found');
  if (u.id === user!.id) return fail(400, 'BAD_REQUEST', 'you cannot disable yourself');
  u.accountStatus = 'disabled';
  audit(user, 'admin.user.disable', 'user', u.id, { username: u.username });
  return ok(u);
}, A);
route('POST', '/admin/users/:id/activate', ({ user, params }) => {
  const u = db.users.find((x) => x.id === params.id);
  if (!u) return fail(404, 'NOT_FOUND', 'user not found');
  u.accountStatus = u.mustChangePassword ? 'pending_password_setup' : 'active';
  audit(user, 'admin.user.activate', 'user', u.id, { username: u.username });
  return ok(u);
}, A);
route('POST', '/admin/users/:id/revoke-sessions', ({ user, params }) => {
  audit(user, 'admin.user.revoke_sessions', 'user', params.id!);
  return ok({ sessionsRevoked: 1 });
}, A);
route('GET', '/admin/websites', ({ query }) => {
  let list = [...db.websites];
  if (query.ownerUserId !== undefined) list = list.filter((w) => w.ownerUserId === query.ownerUserId);
  if (query.isActive !== undefined) list = list.filter((w) => String(w.isActive) === query.isActive);
  if (query.search) list = list.filter((w) => w.slug.startsWith(query.search!.toLowerCase()));
  return paginate(list, query);
}, A);
route('POST', '/admin/websites', ({ user, body }) => {
  const b = body as Record<string, string | boolean>;
  if (db.websites.some((w) => w.slug === b.slug)) return fail(409, 'SLUG_TAKEN', 'slug is already taken');
  const created = nowIso();
  const w: WebsiteView = {
    ...structuredClone(db.websites[0]!),
    id: `w_${newId()}`,
    ownerUserId: (b.ownerUserId as string) ?? '',
    slug: String(b.slug),
    websiteName: String(b.websiteName),
    websiteUrl: String(b.websiteUrl),
    weddingDate: (b.weddingDate as string) || undefined,
    timezone: (b.timezone as string) || 'Asia/Kuala_Lumpur',
    isActive: b.isActive !== false,
    integration: { mode: 'browser', allowedOrigins: [], captchaRequired: false, hasSigningSecret: false },
    createdAt: created,
    updatedAt: created,
  };
  db.websites.push(w);
  const owner = db.users.find((u) => u.id === w.ownerUserId);
  if (owner) owner.websiteIds.push(w.id);
  audit(user, 'admin.website.create', 'website', w.id, { slug: w.slug });
  return ok(w);
}, A);
route('GET', '/admin/websites/:id', ({ params }) => {
  const w = db.websites.find((x) => x.id === params.id);
  return w ? ok(w) : fail(404, 'NOT_FOUND', 'website not found');
}, A);
route('PUT', '/admin/websites/:id', ({ user, params, body }) => {
  const w = db.websites.find((x) => x.id === params.id);
  if (!w) return fail(404, 'NOT_FOUND', 'website not found');
  const b = body as Record<string, unknown>;
  if (b.slug && b.slug !== w.slug) {
    if (db.websites.some((x) => x.slug === b.slug)) return fail(409, 'SLUG_TAKEN', 'slug is already taken');
    audit(user, 'admin.website.slug_change', 'website', w.id, { from: w.slug, to: b.slug });
    w.slug = String(b.slug);
  }
  if (b.integration && (b.integration as { captchaRequired?: boolean }).captchaRequired)
    return validation([{ field: 'integration.captchaRequired', message: 'no CAPTCHA provider is configured on this server' }]);
  for (const k of ['websiteName', 'websiteUrl', 'timezone', 'isActive'] as const) if (b[k] !== undefined) (w as unknown as Record<string, unknown>)[k] = b[k];
  if (b.weddingDate !== undefined) w.weddingDate = (b.weddingDate as string) || undefined;
  if (b.ownerUserId !== undefined && b.ownerUserId !== w.ownerUserId) {
    const prev = db.users.find((u) => u.id === w.ownerUserId);
    if (prev) prev.websiteIds = prev.websiteIds.filter((id) => id !== w.id);
    w.ownerUserId = String(b.ownerUserId);
    const next = db.users.find((u) => u.id === w.ownerUserId);
    if (next && !next.websiteIds.includes(w.id)) next.websiteIds.push(w.id);
    audit(user, 'admin.website.owner_change', 'website', w.id, { ownerUserId: w.ownerUserId });
  }
  if (b.integration) w.integration = { ...w.integration, ...(b.integration as object) };
  const err = applyWebsiteSettings(w, b);
  if (err) return err;
  audit(user, 'admin.website.update', 'website', w.id, { fields: Object.keys(b).join(',') });
  return ok(w);
}, A);
route('POST', '/admin/websites/:id/integration/secret', ({ user, params }) => {
  const w = db.websites.find((x) => x.id === params.id);
  if (!w) return fail(404, 'NOT_FOUND', 'website not found');
  const keyId = `k_${newId().slice(0, 8)}`;
  w.integration = { ...w.integration, hasSigningSecret: true, signingKeyId: keyId, secretRotatedAt: nowIso() };
  audit(user, 'admin.website.rotate_secret', 'website', w.id, { keyId });
  return ok({ websiteId: w.id, keyId, secret: `whsec_${crypto.getRandomValues(new Uint32Array(6)).join('')}`, rotatedAt: nowIso() });
}, A);
route('POST', '/admin/websites/:id/analytics/recompute', ({ user, params }) => {
  const w = db.websites.find((x) => x.id === params.id);
  if (!w) return fail(404, 'NOT_FOUND', 'website not found');
  audit(user, 'admin.website.recompute_stats', 'website', w.id);
  return ok(siteSummary(w));
}, A);
route('GET', '/admin/rsvps', ({ query }) => {
  const list = filterRsvps(query.websiteId ? siteRsvps(query.websiteId) : db.rsvps, query);
  return isResult(list) ? list : paginate(list, query);
}, A);
route('GET', '/admin/wishes', ({ query }) => {
  const list = filterWishes(query.websiteId ? siteWishes(query.websiteId) : db.wishes, query);
  return isResult(list) ? list : paginate(list, query);
}, A);
route('GET', '/admin/analytics', ({ query }) => {
  const rs = query.websiteId ? siteRsvps(query.websiteId) : db.rsvps;
  const ws = query.websiteId ? siteWishes(query.websiteId) : db.wishes;
  const meals = [...new Set(db.websites.flatMap((w) => w.rsvpSettings.mealOptions))];
  const a = computeAnalytics(rs, ws, meals, { from: query.from, to: query.to, granularity: (query.granularity as 'day') ?? 'day', websiteId: query.websiteId });
  return ok({ ...a, websites: db.websites.map(websiteSummary).sort((x, y) => y.summary.totalSubmissions - x.summary.totalSubmissions) });
}, A);
route('GET', '/admin/audit-logs', ({ query }) => {
  let list = db.auditLogs;
  if (query.actorUserId) list = list.filter((l) => l.actorUserId === query.actorUserId);
  if (query.action) list = list.filter((l) => l.action === query.action);
  if (query.targetType) list = list.filter((l) => l.targetType === query.targetType);
  if (query.targetId) list = list.filter((l) => l.targetId === query.targetId);
  if (query.from || query.to) list = list.filter((l) => inRange(l.createdAt, query.from, query.to));
  return paginate(list, query);
}, A);
route('GET', '/admin/export/rsvps', ({ user, query }) => {
  audit(user, 'data.export', 'export', query.websiteId ?? 'all', { type: query.type ?? 'all', format: query.format ?? 'xlsx' });
  const site = db.websites.find((w) => w.id === query.websiteId);
  return exportRsvps(site ? siteRsvps(site.id) : db.rsvps, query, site?.slug ?? 'all-websites', !site);
}, A);
route('GET', '/admin/export/wishes', ({ query }) => {
  const site = db.websites.find((w) => w.id === query.websiteId);
  const list = filterWishes(site ? siteWishes(site.id) : db.wishes, query);
  if (isResult(list)) return list;
  const slug = (id: string) => db.websites.find((w) => w.id === id)?.slug ?? '';
  return fileResult(
    [['Website', 'Sender', 'Message', 'Visible', 'Submitted at'], ...list.map((w) => [slug(w.websiteId), w.senderName, w.message, String(w.isVisible), w.createdAt])],
    `${site?.slug ?? 'all-websites'}-wishes`,
    query.format ?? 'xlsx',
  );
}, A);

// ---- adapter ----
function dispatch(config: InternalAxiosRequestConfig): MockResult {
  const method = (config.method ?? 'get').toUpperCase();
  const base = (config.baseURL ?? '').replace(/\/+$/, '');
  let path = (config.url ?? '').replace(base, '');
  path = path.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/v1/, '').split('?')[0] ?? '';
  const query: Q = {};
  for (const [k, v] of Object.entries((config.params ?? {}) as Record<string, unknown>)) {
    if (v !== undefined && v !== null && v !== '') query[k] = String(v);
  }
  let body: Record<string, unknown> = {};
  if (typeof config.data === 'string' && config.data) {
    try {
      body = JSON.parse(config.data) as Record<string, unknown>;
    } catch {
      return fail(400, 'BAD_REQUEST', 'invalid JSON');
    }
  }

  for (const [m, re, handler, opts] of routes) {
    if (m !== method) continue;
    const match = re.exec(path);
    if (!match) continue;
    const s = session();
    if (opts?.auth !== false) {
      if (!s) return fail(401, 'UNAUTHORIZED', 'authentication required');
      if (s.restricted && !opts?.allowRestricted) return fail(403, 'PASSWORD_CHANGE_REQUIRED', 'password change required');
      if (opts?.admin && s.user.role !== 'admin') return fail(403, 'FORBIDDEN', 'admin access required');
      if (method !== 'GET') {
        const headers = AxiosHeaders.from(config.headers);
        if (headers.get('X-CSRF-Token') !== csrf) return fail(403, 'CSRF_INVALID', 'invalid CSRF token');
      }
    }
    return handler({ params: (match.groups ?? {}) as Record<string, string>, query, body, user: s?.user ?? null, restricted: s?.restricted ?? false });
  }
  return fail(404, 'NOT_FOUND', `no mock route for ${method} ${path}`);
}

export function installMockApi(instance: AxiosInstance) {
  instance.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    await new Promise((r) => setTimeout(r, 180 + Math.random() * 320));
    const result = dispatch(config);
    const response: AxiosResponse = {
      data: result.data,
      status: result.status,
      statusText: String(result.status),
      headers: { 'x-request-id': Math.random().toString(36).slice(2, 18), ...(result.headers ?? {}) },
      config,
      request: {},
    };
    if (result.status >= 200 && result.status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${result.status}`,
      result.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response,
    );
  };
  console.info(
    '%c[mock api]%c In-memory mock API enabled (development only). Sign in with admin / admin-dev-passphrase or luqman / customer-dev-passphrase.',
    'color:#2a78d6;font-weight:600',
    'color:inherit',
  );
}

