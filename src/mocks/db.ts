/**
 * DEVELOPMENT-ONLY mock data. Never imported by production code paths
 * (main.tsx loads it only when `import.meta.env.DEV && VITE_USE_MOCKS === 'true'`).
 * Shapes follow the documented API contract exactly.
 */
import type {
  AuditLog,
  GuestDetail,
  GuestType,
  Rsvp,
  UserView,
  WebsiteView,
  Wish,
} from '@/types/api';

// Deterministic PRNG so the mock data is stable between reloads.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261111);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
let idCounter = 1000;
export const newId = () => (idCounter++).toString(16).padStart(6, '0') + Math.floor(rand() * 1e12).toString(16).padStart(14, '0');

const DAY = 86_400_000;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

const FIRST = ['Ahmad', 'Nur', 'Siti', 'Muhammad', 'Aisyah', 'Hafiz', 'Farah', 'Daniel', 'Mei Ling', 'Arjun', 'Priya', 'Amirul', 'Hana', 'Zul', 'Lina', 'Iskandar', 'Sofia', 'Kumar', 'Wei Jie', 'Nadia', 'Irfan', 'Alya', 'Haziq', 'Mira', 'Syafiq', 'Aina', 'Jason', 'Chloe', 'Faiz', 'Balqis'];
const LAST = ['bin Ali', 'binti Hassan', 'Rahman', 'Tan', 'Lim', 'Abdullah', 'Ismail', 'Wong', 'Raj', 'Yusof', 'Chong', 'Karim', 'Othman', 'Lee', 'Nair', 'Zainal', 'Ng', 'Salleh'];
const DIETARY = ['', '', '', '', '', 'Vegetarian', 'No peanuts please', 'Halal only', 'Gluten free', 'Allergic to seafood', 'Lactose intolerant', 'Vegan', 'No eggs', 'Nut allergy (severe)'];
const NOTES = ['', '', '', '', 'Arriving early to help set up', 'Will be bringing a gift from the family', 'May arrive a bit late after work', 'Congratulations!\nSo happy for you both.', 'Need parking for one car', 'Wheelchair access needed for my grandmother'];
const WISHES = [
  'Congratulations to the happy couple! Wishing you a lifetime of love and happiness.',
  'Selamat pengantin baru! Semoga berbahagia hingga ke jannah.',
  'So happy for you both. May your marriage be filled with laughter, patience and endless adventures.',
  'Wishing you both all the love in the world. Can’t wait to celebrate with you!',
  'Barakallahu lakuma wa baraka alaikuma wa jama’a bainakuma fi khair.',
  'From the first day we met you two, we knew this was meant to be. Congratulations!\n\nLove,\nThe whole family',
  'May your home be filled with joy and your hearts with peace. Congrats!',
  'Cheers to love, laughter and happily ever after!',
  'Sorry we can’t make it, but we are sending all our love from far away. Congratulations!',
  'Two wonderful people, one beautiful journey. Wishing you every happiness.',
];
const GUEST_EXTRA = ['Spouse', 'Mother', 'Father', 'Son', 'Daughter', 'Sister', 'Brother', 'Friend'];
const WORDS = ['abacus', 'ladder', 'mosaic', 'velvet', 'orbit', 'prism', 'harbor', 'quill', 'lantern', 'meadow', 'cobalt', 'ember', 'willow', 'summit', 'canvas', 'falcon', 'garnet', 'juniper'];

export const tempPassword = () => Array.from({ length: 8 }, () => pick(WORDS)).join('-');

function defaultSettings(timezone = 'Asia/Kuala_Lumpur') {
  return { displayName: '', timezone, defaultExportFormat: 'xlsx' as const, defaultPageSize: 20 };
}

function makeUser(p: Partial<UserView> & Pick<UserView, 'id' | 'username' | 'role'>): UserView {
  const created = iso(now - 120 * DAY);
  return {
    accountStatus: 'active',
    mustChangePassword: false,
    websiteIds: [],
    settings: defaultSettings(),
    isLocked: false,
    createdAt: created,
    updatedAt: created,
    passwordChangedAt: created,
    lastLoginAt: iso(now - 2 * DAY),
    ...p,
  };
}

function makeWebsite(p: Partial<WebsiteView> & Pick<WebsiteView, 'id' | 'slug' | 'websiteName'>): WebsiteView {
  const created = iso(now - 110 * DAY);
  return {
    ownerUserId: '',
    websiteUrl: `https://${p.slug}.com`,
    timezone: 'Asia/Kuala_Lumpur',
    isActive: true,
    rsvpSettings: {
      acceptingRsvps: true,
      rsvpDeadline: iso(now + 20 * DAY),
      maxGuestsPerRsvp: 10,
      mealOptions: ['standard', 'vegetarian', 'vegan', 'halal', 'gluten_free', 'kids', 'other'],
      duplicatePolicy: 'update',
      requirePhone: true,
    },
    wishSettings: { acceptingWishes: true, autoApprove: true },
    integration: { mode: 'browser', allowedOrigins: [`https://${p.slug}.com`], captchaRequired: false, hasSigningSecret: false },
    createdAt: created,
    updatedAt: created,
    ...p,
  };
}

export interface MockDb {
  users: UserView[];
  passwords: Map<string, string>;
  websites: WebsiteView[];
  rsvps: Rsvp[];
  wishes: Wish[];
  auditLogs: AuditLog[];
}

function genRsvps(website: WebsiteView, count: number, endMs: number, spanDays: number): Rsvp[] {
  const out: Rsvp[] = [];
  const phones = new Set<string>();
  for (let i = 0; i < count; i++) {
    // Skew submissions towards recent days.
    const age = Math.floor(Math.pow(rand(), 1.6) * spanDays);
    const created = endMs - age * DAY - Math.floor(rand() * DAY);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const attending = chance(0.8);
    const n = attending ? pick([1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6]) : pick([1, 1, 1, 2, 2, 3]);
    let phone = '';
    do phone = `601${Math.floor(10_000_000 + rand() * 89_999_999)}`;
    while (phones.has(phone));
    phones.add(phone);
    let details: GuestDetail[] | null = null;
    if (chance(0.7)) {
      details = [{ name, type: 'adult' }];
      for (let g = 1; g < n; g++) {
        const type: GuestType = g >= 2 && chance(0.45) ? (chance(0.25) ? 'infant' : 'child') : 'adult';
        details.push({ name: `${pick(FIRST)} (${pick(GUEST_EXTRA)})`, type });
      }
    } else if (chance(0.3)) {
      details = [];
    }
    out.push({
      id: newId(),
      websiteId: website.id,
      guestName: name,
      phoneNumber: phone,
      attendanceStatus: attending ? 'attending' : 'not_attending',
      numberOfGuests: n,
      guestDetails: details,
      mealPreference: attending && chance(0.85) ? pick(website.rsvpSettings.mealOptions.slice(0, 6)) : '',
      dietaryRequirements: attending ? pick(DIETARY) : '',
      notes: pick(NOTES),
      source: chance(0.92) ? 'browser' : 'dashboard',
      createdAt: iso(created),
      updatedAt: iso(created + (chance(0.1) ? DAY : 0)),
    });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function genWishes(website: WebsiteView, rsvps: Rsvp[], ratio: number): Wish[] {
  return rsvps
    .filter(() => chance(ratio))
    .map((r) => {
      const created = new Date(r.createdAt).getTime() + Math.floor(rand() * 3600_000);
      return {
        id: newId(),
        websiteId: website.id,
        senderName: r.guestName,
        message: pick(WISHES),
        isVisible: website.wishSettings.autoApprove ? chance(0.95) : chance(0.4),
        isFavourite: chance(0.15),
        source: 'browser' as const,
        createdAt: iso(created),
        updatedAt: iso(created),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createDb(): MockDb {
  const admin = makeUser({ id: 'u_admin', username: 'admin', role: 'admin', settings: { ...defaultSettings(), displayName: 'Platform Admin' } });
  const luqman = makeUser({ id: 'u_luqman', username: 'luqman', role: 'customer', settings: { ...defaultSettings(), displayName: 'Luqman & Amin' }, createdAt: iso(now - 95 * DAY) });
  const sarah = makeUser({
    id: 'u_sarah',
    username: 'sarah',
    role: 'customer',
    accountStatus: 'pending_password_setup',
    mustChangePassword: true,
    temporaryPasswordExpiresAt: iso(now + 6 * DAY),
    createdAt: iso(now - 1 * DAY),
    lastLoginAt: undefined,
    passwordChangedAt: undefined,
  });
  const hafiz = makeUser({ id: 'u_hafiz', username: 'hafiz.n', role: 'customer', createdAt: iso(now - 160 * DAY) });
  const daniel = makeUser({ id: 'u_daniel', username: 'daniel', role: 'customer', accountStatus: 'disabled', createdAt: iso(now - 70 * DAY) });

  const w1 = makeWebsite({ id: 'w_luqman_amin', slug: 'luqman-amin', websiteName: 'Luqman & Amin', ownerUserId: luqman.id, weddingDate: isoDate(now + 38 * DAY) });
  const w2 = makeWebsite({
    id: 'w_luqman_amin_reception',
    slug: 'luqman-amin-reception',
    websiteName: 'Luqman & Amin — Reception',
    ownerUserId: luqman.id,
    weddingDate: isoDate(now + 59 * DAY),
    rsvpSettings: { ...makeWebsite({ id: 'x', slug: 'x', websiteName: 'x' }).rsvpSettings, mealOptions: ['chicken', 'fish', 'vegetarian', 'kids'] },
  });
  const w3 = makeWebsite({ id: 'w_ahmad_sarah', slug: 'ahmad-sarah', websiteName: 'Ahmad & Sarah', ownerUserId: sarah.id, weddingDate: isoDate(now + 120 * DAY), wishSettings: { acceptingWishes: true, autoApprove: false } });
  const w4 = makeWebsite({ id: 'w_hafiz_nadia', slug: 'hafiz-nadia', websiteName: 'Hafiz & Nadia', ownerUserId: hafiz.id, weddingDate: isoDate(now - 39 * DAY), rsvpSettings: { ...makeWebsite({ id: 'x', slug: 'x', websiteName: 'x' }).rsvpSettings, acceptingRsvps: false } });
  const w5 = makeWebsite({ id: 'w_daniel_mei', slug: 'daniel-mei', websiteName: 'Daniel & Mei Ling', ownerUserId: daniel.id, isActive: false, weddingDate: isoDate(now + 200 * DAY) });
  const w6 = makeWebsite({ id: 'w_demo', slug: 'demo-template', websiteName: 'Demo template', isActive: false, integration: { mode: 'signed', allowedOrigins: [], captchaRequired: false, hasSigningSecret: true, signingKeyId: 'k_demo01', secretRotatedAt: iso(now - 30 * DAY) } });

  luqman.websiteIds = [w1.id, w2.id];
  sarah.websiteIds = [w3.id];
  hafiz.websiteIds = [w4.id];
  daniel.websiteIds = [w5.id];

  const r1 = genRsvps(w1, 146, now, 75);
  const r2 = genRsvps(w2, 42, now, 40);
  const r3 = genRsvps(w3, 18, now, 12);
  const r4 = genRsvps(w4, 112, now - 45 * DAY, 90);
  const r5 = genRsvps(w5, 4, now - 60 * DAY, 10);

  const wishes = [
    ...genWishes(w1, r1, 0.35),
    ...genWishes(w2, r2, 0.25),
    ...genWishes(w3, r3, 0.6),
    ...genWishes(w4, r4, 0.4),
  ];

  const passwords = new Map<string, string>([
    [admin.id, 'admin-dev-passphrase'],
    [luqman.id, 'customer-dev-passphrase'],
    [sarah.id, 'abacus-ladder-mosaic-velvet-orbit-prism-harbor-quill'],
    [hafiz.id, 'customer-dev-passphrase'],
    [daniel.id, 'customer-dev-passphrase'],
  ]);

  const auditLogs: AuditLog[] = [];
  const log = (offsetMs: number, actor: UserView | null, action: string, targetType: AuditLog['targetType'], targetId: string, metadata: Record<string, unknown> = {}) =>
    auditLogs.push({
      id: newId(),
      actorUserId: actor?.id ?? '',
      actorUsername: actor?.username ?? '',
      actorRole: actor?.role ?? '',
      action,
      targetType,
      targetId,
      metadata,
      ipAddress: actor ? `10.0.${Math.floor(rand() * 200)}.${Math.floor(rand() * 250)}` : '',
      requestId: Math.random().toString(36).slice(2, 18),
      createdAt: iso(now - offsetMs),
    });
  log(160 * DAY, null, 'admin.bootstrap', 'user', admin.id, { username: 'admin' });
  log(160 * DAY - 3600_000, admin, 'admin.user.create', 'user', hafiz.id, { username: hafiz.username, websiteSlug: w4.slug });
  log(95 * DAY, admin, 'admin.user.create', 'user', luqman.id, { username: luqman.username, websiteSlug: w1.slug });
  log(94 * DAY, admin, 'admin.website.create', 'website', w2.id, { slug: w2.slug });
  log(70 * DAY, admin, 'admin.user.create', 'user', daniel.id, { username: daniel.username, websiteSlug: w5.slug });
  log(20 * DAY, admin, 'admin.user.disable', 'user', daniel.id, { username: daniel.username });
  log(19 * DAY, admin, 'admin.website.update', 'website', w5.id, { fields: 'isActive' });
  log(6 * DAY, luqman, 'website.settings.update', 'website', w1.id, { fields: 'rsvpSettings.mealOptions' });
  log(5 * DAY, luqman, 'data.export', 'export', w1.id, { type: 'all', format: 'xlsx', rows: 120 });
  log(3 * DAY, hafiz, 'auth.login.failed', 'session', hafiz.id, { reason: 'invalid_credentials' });
  log(3 * DAY - 60_000, hafiz, 'auth.login.success', 'session', hafiz.id, {});
  log(2 * DAY, luqman, 'rsvp.update', 'rsvp', r1[3]!.id, { websiteSlug: w1.slug });
  log(1 * DAY, admin, 'admin.user.create', 'user', sarah.id, { username: sarah.username, websiteSlug: w3.slug });
  log(4 * 3600_000, luqman, 'auth.login.success', 'session', luqman.id, {});
  auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    users: [admin, luqman, sarah, hafiz, daniel],
    passwords,
    websites: [w1, w2, w3, w4, w5, w6],
    rsvps: [...r1, ...r2, ...r3, ...r4, ...r5],
    wishes,
    auditLogs,
  };
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
export const nowIso = () => iso(Date.now());
