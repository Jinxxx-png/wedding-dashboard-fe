import { formatDistanceToNowStrict } from 'date-fns';
import type { Granularity } from '@/types/api';

const numberFmt = new Intl.NumberFormat('en-US');
const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return numberFmt.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.abs(value) < 10_000 ? numberFmt.format(value) : compactFmt.format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits).replace(/\.0+$/, '')}%`;
}

function safeTimeZone(timeZone?: string): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone }).format(0);
    return timeZone;
  } catch {
    return undefined;
  }
}

/** RFC 3339 timestamp (UTC) → "10 Nov 2026" in the given IANA timezone. */
export function formatDate(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: safeTimeZone(timeZone),
  }).format(d);
}

/** RFC 3339 timestamp (UTC) → "10 Nov 2026, 16:54" in the given IANA timezone. */
export function formatDateTime(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: safeTimeZone(timeZone),
  }).format(d);
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** Calendar date `YYYY-MM-DD` → "Sat, 12 Dec 2026" without timezone shifting. */
export function formatCalendarDate(ymd: string | null | undefined, withWeekday = false): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-GB', {
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Local Date → `YYYY-MM-DD` */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Trend period label: "2026-11-10" → "10 Nov", "2026-W46" → "W46", "2026-11" → "Nov 26". */
export function formatPeriod(period: string, granularity: Granularity): string {
  if (granularity === 'week') {
    const m = /W(\d+)$/.exec(period);
    return m ? `W${m[1]}` : period;
  }
  const parts = period.split('-');
  if (granularity === 'month' && parts.length >= 2) {
    const month = MONTHS[Number(parts[1]) - 1];
    return month ? `${month} ${parts[0]!.slice(2)}` : period;
  }
  if (parts.length === 3) {
    const month = MONTHS[Number(parts[1]) - 1];
    return month ? `${Number(parts[2])} ${month}` : period;
  }
  return period;
}

/** "gluten_free" → "Gluten free" */
export function humanize(key: string | null | undefined): string {
  if (!key) return '—';
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** Countdown label from `daysUntilWedding` (negative after the wedding). */
export function weddingCountdown(days: number | undefined | null): string | null {
  if (days === undefined || days === null) return null;
  if (days === 0) return 'Wedding day is today';
  if (days > 0) return `${formatNumber(days)} day${days === 1 ? '' : 's'} to go`;
  const past = Math.abs(days);
  return `${formatNumber(past)} day${past === 1 ? '' : 's'} ago`;
}

/** Days until a `YYYY-MM-DD` date, relative to today (local). */
export function daysUntil(ymd: string | undefined): number | undefined {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  return phone.startsWith('+') ? phone : `+${phone}`;
}
