import type {
  Analytics,
  AttendanceSummary,
  MeResponse,
  PageMeta,
  Paginated,
  Rsvp,
  UserView,
  WebsiteView,
} from '@/types/api';

export function makeUser(overrides: Partial<UserView> = {}): UserView {
  return {
    id: 'u1',
    username: 'luqman',
    role: 'customer',
    accountStatus: 'active',
    mustChangePassword: false,
    websiteIds: ['w1'],
    settings: { displayName: '', timezone: 'Asia/Kuala_Lumpur', defaultExportFormat: 'xlsx', defaultPageSize: 20 },
    isLocked: false,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export const makeAdmin = (o: Partial<UserView> = {}) => makeUser({ id: 'admin1', username: 'admin', role: 'admin', websiteIds: [], ...o });

export function makeMe(user: UserView, mustChangePassword = user.mustChangePassword): MeResponse {
  return { user, csrfToken: 'csrf-test', sessionExpiresAt: '2099-01-01T00:00:00Z', mustChangePassword };
}

export function makeWebsite(overrides: Partial<WebsiteView> = {}): WebsiteView {
  return {
    id: 'w1',
    ownerUserId: 'u1',
    slug: 'luqman-amin',
    websiteName: 'Luqman & Amin',
    websiteUrl: 'https://luqman-amin.com',
    weddingDate: '2026-12-19',
    timezone: 'Asia/Kuala_Lumpur',
    isActive: true,
    rsvpSettings: {
      acceptingRsvps: true,
      maxGuestsPerRsvp: 10,
      mealOptions: ['standard', 'vegetarian'],
      duplicatePolicy: 'update',
      requirePhone: true,
    },
    wishSettings: { acceptingWishes: true, autoApprove: true },
    integration: { mode: 'browser', allowedOrigins: [], captchaRequired: false, hasSigningSecret: false },
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<AttendanceSummary> = {}): AttendanceSummary {
  return {
    totalSubmissions: 100,
    attendingSubmissions: 80,
    declinedSubmissions: 20,
    attendingGuests: 185,
    declinedGuests: 31,
    expectedAttendees: 185,
    totalWishes: 42,
    attendancePercentage: 80,
    guestAttendancePercentage: 85.65,
    averageGuestsPerAttendingRsvp: 2.31,
    ...overrides,
  };
}

export function makeAnalytics(overrides: Partial<Analytics> = {}): Analytics {
  const summary = overrides.summary ?? makeSummary();
  return {
    websiteId: 'w1',
    granularity: 'day',
    summary,
    attendingVsDeclined: {
      attending: { submissions: summary.attendingSubmissions, guests: summary.attendingGuests, submissionsPercentage: 80, guestsPercentage: 85.65 },
      declined: { submissions: summary.declinedSubmissions, guests: summary.declinedGuests, submissionsPercentage: 20, guestsPercentage: 14.35 },
    },
    guestBreakdown: { totalAttendingGuests: summary.attendingGuests, adults: 150, children: 25, infants: 5, unspecified: 5 },
    mealPreferences: [
      { key: 'standard', submissions: 50, guests: 120 },
      { key: 'vegetarian', submissions: 20, guests: 45 },
      { key: 'unspecified', submissions: 10, guests: 20 },
    ],
    dietaryRequirements: [{ key: 'none', submissions: 70, guests: 160 }],
    trends: [],
    ...overrides,
  };
}

export function makeRsvp(overrides: Partial<Rsvp> = {}): Rsvp {
  return {
    id: 'r1',
    websiteId: 'w1',
    guestName: 'Ahmad Rahman',
    phoneNumber: '60123456789',
    attendanceStatus: 'attending',
    numberOfGuests: 3,
    guestDetails: [
      { name: 'Ahmad Rahman', type: 'adult' },
      { name: 'Guest 2', type: 'adult' },
      { name: 'Guest 3', type: 'child' },
    ],
    mealPreference: 'standard',
    dietaryRequirements: 'No peanuts',
    notes: 'Arriving early',
    source: 'browser',
    createdAt: '2026-11-10T08:54:22Z',
    updatedAt: '2026-11-10T08:54:22Z',
    ...overrides,
  };
}

export function page<T>(items: T[], meta: Partial<PageMeta> = {}): Paginated<T> {
  return {
    items,
    meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1, hasNext: false, ...meta },
  };
}

/** A promise that never settles — keeps a query in its loading state. */
export const pending = <T,>() => new Promise<T>(() => {});
