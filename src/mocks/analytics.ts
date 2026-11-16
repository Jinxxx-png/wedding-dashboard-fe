/** DEVELOPMENT-ONLY: computes analytics shapes from mock records (mirrors backend semantics). */
import type {
  Analytics,
  AttendanceSummary,
  BreakdownItem,
  Granularity,
  Rsvp,
  TrendPoint,
  Wish,
} from '@/types/api';

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function inRange(createdAt: string, from?: string, to?: string): boolean {
  const day = createdAt.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function summarize(rsvps: Rsvp[], wishes: Wish[]): AttendanceSummary {
  const att = rsvps.filter((r) => r.attendanceStatus === 'attending');
  const dec = rsvps.filter((r) => r.attendanceStatus === 'not_attending');
  const attendingGuests = att.reduce((s, r) => s + r.numberOfGuests, 0);
  const declinedGuests = dec.reduce((s, r) => s + r.numberOfGuests, 0);
  const total = rsvps.length;
  return {
    totalSubmissions: total,
    attendingSubmissions: att.length,
    declinedSubmissions: dec.length,
    attendingGuests,
    declinedGuests,
    expectedAttendees: attendingGuests,
    totalWishes: wishes.length,
    attendancePercentage: total ? round2((att.length / total) * 100) : 0,
    guestAttendancePercentage: attendingGuests + declinedGuests ? round2((attendingGuests / (attendingGuests + declinedGuests)) * 100) : 0,
    averageGuestsPerAttendingRsvp: att.length ? round2(attendingGuests / att.length) : 0,
  };
}

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodBounds(granularity: Granularity, from?: string, to?: string): { start: Date; end: Date } {
  const end = to ? new Date(`${to}T00:00:00Z`) : new Date(`${ymd(new Date())}T00:00:00Z`);
  if (from) return { start: new Date(`${from}T00:00:00Z`), end };
  const start = new Date(end);
  if (granularity === 'day') start.setUTCDate(start.getUTCDate() - 29);
  else if (granularity === 'week') start.setUTCDate(start.getUTCDate() - 7 * 11 - ((start.getUTCDay() + 6) % 7));
  else start.setUTCMonth(start.getUTCMonth() - 11, 1);
  return { start, end };
}

export function trends(rsvps: Rsvp[], wishes: Wish[], granularity: Granularity, from?: string, to?: string): TrendPoint[] {
  const { start, end } = periodBounds(granularity, from, to);
  const points = new Map<string, TrendPoint>();
  const cursor = new Date(start);
  if (granularity === 'week') cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  if (granularity === 'month') cursor.setUTCDate(1);
  let guard = 0;
  while (cursor <= end && guard++ < 1200) {
    const periodStart = new Date(cursor);
    let key: string;
    const periodEnd = new Date(cursor);
    if (granularity === 'day') {
      key = ymd(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else if (granularity === 'week') {
      key = isoWeek(cursor);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      key = ymd(cursor).slice(0, 7);
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1, 0);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
    points.set(key, {
      period: key,
      startDate: ymd(periodStart),
      endDate: ymd(periodEnd),
      submissions: 0,
      attending: 0,
      declined: 0,
      attendingGuests: 0,
      declinedGuests: 0,
      wishes: 0,
    });
  }
  const keyOf = (createdAt: string) => {
    const d = new Date(createdAt);
    return granularity === 'day' ? ymd(d) : granularity === 'week' ? isoWeek(d) : ymd(d).slice(0, 7);
  };
  for (const r of rsvps) {
    const p = points.get(keyOf(r.createdAt));
    if (!p) continue;
    p.submissions++;
    if (r.attendanceStatus === 'attending') {
      p.attending++;
      p.attendingGuests += r.numberOfGuests;
    } else {
      p.declined++;
      p.declinedGuests += r.numberOfGuests;
    }
  }
  for (const w of wishes) {
    const p = points.get(keyOf(w.createdAt));
    if (p) p.wishes++;
  }
  return [...points.values()];
}

const DIET_RULES: [string, RegExp][] = [
  ['vegetarian', /vegetarian/i],
  ['vegan', /vegan/i],
  ['halal', /halal/i],
  ['gluten_free', /gluten/i],
  ['nut_allergy', /nut|peanut/i],
  ['dairy_free', /dairy|lactose|milk/i],
  ['seafood_allergy', /seafood|shellfish|fish/i],
  ['egg_allergy', /egg/i],
];

export function computeAnalytics(
  rsvpsAll: Rsvp[],
  wishesAll: Wish[],
  mealOptions: string[],
  opts: { from?: string; to?: string; granularity?: Granularity; websiteId?: string },
): Analytics {
  const granularity = opts.granularity ?? 'day';
  const rsvps = rsvpsAll.filter((r) => inRange(r.createdAt, opts.from, opts.to));
  const wishes = wishesAll.filter((w) => inRange(w.createdAt, opts.from, opts.to));
  const summary = summarize(rsvps, wishes);
  const att = rsvps.filter((r) => r.attendanceStatus === 'attending');

  const guestBreakdown = { totalAttendingGuests: summary.attendingGuests, adults: 0, children: 0, infants: 0, unspecified: 0 };
  for (const r of att) {
    const d = r.guestDetails ?? [];
    if (d.length === 0) guestBreakdown.unspecified += r.numberOfGuests;
    else
      for (const g of d) {
        if (g.type === 'adult') guestBreakdown.adults++;
        else if (g.type === 'child') guestBreakdown.children++;
        else guestBreakdown.infants++;
      }
  }

  const meals = new Map<string, BreakdownItem>([...mealOptions, 'unspecified'].map((k) => [k, { key: k, submissions: 0, guests: 0 }]));
  for (const r of att) {
    const key = r.mealPreference && meals.has(r.mealPreference) ? r.mealPreference : 'unspecified';
    const m = meals.get(key)!;
    m.submissions++;
    m.guests += r.numberOfGuests;
  }

  const diet = new Map<string, BreakdownItem>(
    ['none', ...DIET_RULES.map(([k]) => k), 'other'].map((k) => [k, { key: k, submissions: 0, guests: 0 }]),
  );
  for (const r of att) {
    const text = r.dietaryRequirements.trim();
    const hits = text ? DIET_RULES.filter(([, re]) => re.test(text)).map(([k]) => k) : ['none'];
    for (const k of hits.length ? hits : ['other']) {
      const item = diet.get(k)!;
      item.submissions++;
      item.guests += r.numberOfGuests;
    }
  }

  const declinedGuests = summary.declinedGuests;
  const totalGuests = summary.attendingGuests + declinedGuests;
  return {
    websiteId: opts.websiteId,
    from: opts.from,
    to: opts.to,
    granularity,
    summary,
    attendingVsDeclined: {
      attending: {
        submissions: summary.attendingSubmissions,
        guests: summary.attendingGuests,
        submissionsPercentage: summary.attendancePercentage,
        guestsPercentage: totalGuests ? round2((summary.attendingGuests / totalGuests) * 100) : 0,
      },
      declined: {
        submissions: summary.declinedSubmissions,
        guests: declinedGuests,
        submissionsPercentage: summary.totalSubmissions ? round2(100 - summary.attendancePercentage) : 0,
        guestsPercentage: totalGuests ? round2((declinedGuests / totalGuests) * 100) : 0,
      },
    },
    guestBreakdown,
    mealPreferences: [...meals.values()],
    dietaryRequirements: [...diet.values()],
    trends: trends(rsvps, wishes, granularity, opts.from, opts.to),
  };
}
