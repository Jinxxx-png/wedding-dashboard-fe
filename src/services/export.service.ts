import { apiDownload } from './api';
import type { ExportFormat, ExportQuery, ListQuery, RsvpExportType } from '@/types/api';

/**
 * Backend-generated exports (CSV / XLSX). The backend is authoritative for content and
 * authorization; the frontend only forwards the active filters and saves the file.
 */

export type ExportKind = 'rsvp' | 'attending' | 'declined' | 'guests' | 'wishes' | 'attendance';

const KIND_SUFFIX: Record<ExportKind, string> = {
  rsvp: 'rsvp',
  attending: 'rsvp-attending',
  declined: 'rsvp-declined',
  guests: 'guests',
  wishes: 'wishes',
  attendance: 'attendance',
};

const RSVP_TYPE: Partial<Record<ExportKind, RsvpExportType>> = {
  rsvp: 'all',
  attending: 'attending',
  declined: 'declined',
  guests: 'guests',
};

/** e.g. `luqman-amin-rsvp.xlsx`, `luqman-amin-wishes.csv`, `all-websites-rsvp.csv` */
export function buildExportFilename(prefix: string, kind: ExportKind, format: ExportFormat): string {
  const safe = (prefix || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe || 'wedding-project'}-${KIND_SUFFIX[kind]}.${format}`;
}

/** Exports cover every matching row, so pagination params are never forwarded. */
function exportFilters(filters: ListQuery = {}): ListQuery {
  const rest: ListQuery = { ...filters };
  delete rest.page;
  delete rest.pageSize;
  return rest;
}

const enc = encodeURIComponent;
const site = (websiteId: string) => `/customer/websites/${enc(websiteId)}`;

type AdminFilters = ListQuery & { websiteId?: string };

export const exportService = {
  /** RSVP-based exports for one website: all / attending / declined / guest list. */
  websiteRsvps(websiteId: string, slug: string, kind: ExportKind, format: ExportFormat, filters?: ListQuery) {
    const type = RSVP_TYPE[kind] ?? 'all';
    const query: ExportQuery = { ...exportFilters(filters), format, type };
    // The export type decides the attendance subset — don't send a conflicting status filter.
    if (type === 'attending' || type === 'declined') delete query.attendanceStatus;
    return apiDownload(`${site(websiteId)}/export/rsvps`, query, buildExportFilename(slug, kind, format));
  },

  websiteWishes(websiteId: string, slug: string, format: ExportFormat, filters?: ListQuery) {
    const query: ExportQuery = { ...exportFilters(filters), format };
    return apiDownload(`${site(websiteId)}/export/wishes`, query, buildExportFilename(slug, 'wishes', format));
  },

  /** Attendance report (XLSX has 4 sheets: summary, RSVP list, guest details, wishes). */
  websiteAttendance(
    websiteId: string,
    slug: string,
    format: ExportFormat,
    filters?: Pick<ListQuery, 'from' | 'to' | 'search' | 'attendanceStatus'>,
  ) {
    const query: ExportQuery = { ...filters, format };
    return apiDownload(
      `${site(websiteId)}/export/attendance`,
      query,
      buildExportFilename(slug, 'attendance', format),
    );
  },

  /** Admin: platform-wide RSVP export. Without websiteId the first column is the website slug. */
  adminRsvps(kind: ExportKind, format: ExportFormat, filters?: AdminFilters, slug?: string) {
    const type = RSVP_TYPE[kind] ?? 'all';
    const query: ExportQuery & { websiteId?: string } = { ...exportFilters(filters), format, type };
    if (type === 'attending' || type === 'declined') delete query.attendanceStatus;
    return apiDownload('/admin/export/rsvps', query, buildExportFilename(slug ?? 'all-websites', kind, format));
  },

  adminWishes(format: ExportFormat, filters?: AdminFilters, slug?: string) {
    const query: ExportQuery & { websiteId?: string } = { ...exportFilters(filters), format };
    return apiDownload(
      '/admin/export/wishes',
      query,
      buildExportFilename(slug ?? 'all-websites', 'wishes', format),
    );
  },
};
