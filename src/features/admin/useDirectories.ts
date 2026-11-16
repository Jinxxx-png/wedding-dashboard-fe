import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { queryKeys } from '@/lib/query';
import type { AttendanceSummary, Paginated, UserView, WebsiteView } from '@/types/api';

const MAX_PAGES = 20; // 2,000 records at pageSize 100 — plenty for lookup tables.

/** Fetches every page of a paginated admin list (pageSize max is 100). */
async function fetchAll<T>(fetchPage: (page: number) => Promise<Paginated<T>>): Promise<T[]> {
  const first = await fetchPage(1);
  const totalPages = Math.min(first.meta.totalPages || 1, MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(totalPages - 1, 0) }, (_, i) => fetchPage(i + 2)));
  return [first, ...rest].flatMap((p) => p.items);
}

/**
 * Lookup of all websites for admin views. RSVP/wish rows only carry `websiteId`,
 * so the guide recommends mapping ids to name/slug via the websites list.
 */
export function useWebsiteDirectory() {
  const query = useQuery({
    queryKey: queryKeys.admin.websiteDirectory,
    queryFn: () => fetchAll((page) => adminService.websites({ page, pageSize: 100 })),
    staleTime: 60_000,
  });
  const websites = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(() => new Map(websites.map((w) => [w.id, w])), [websites]);
  const get = useCallback((id: string): WebsiteView | undefined => byId.get(id), [byId]);
  const byOwner = useMemo(() => {
    const map = new Map<string, WebsiteView[]>();
    for (const w of websites) {
      if (!w.ownerUserId) continue;
      map.set(w.ownerUserId, [...(map.get(w.ownerUserId) ?? []), w]);
    }
    return map;
  }, [websites]);
  return { ...query, websites, byId, get, byOwner };
}

export function useCustomerDirectory() {
  const query = useQuery({
    queryKey: queryKeys.admin.customerDirectory,
    queryFn: () => fetchAll((page) => adminService.users({ page, pageSize: 100, role: 'customer' })),
    staleTime: 60_000,
  });
  const customers = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(() => new Map<string, UserView>(customers.map((c) => [c.id, c])), [customers]);
  return { ...query, customers, byId };
}

/** All-time per-website summaries from `GET /admin/analytics` (websites table). */
export function useWebsiteStats() {
  const query = useQuery({
    queryKey: queryKeys.admin.analytics({}),
    queryFn: () => adminService.analytics({}),
    staleTime: 60_000,
  });
  const byWebsite = useMemo(
    () => new Map<string, AttendanceSummary>((query.data?.websites ?? []).map((w) => [w.websiteId, w.summary])),
    [query.data],
  );
  return { ...query, byWebsite };
}

/** Sums the summaries of a customer's websites. */
export function sumSummaries(ids: string[], stats: Map<string, AttendanceSummary>) {
  return ids.reduce(
    (acc, id) => {
      const s = stats.get(id);
      if (!s) return acc;
      return {
        submissions: acc.submissions + s.totalSubmissions,
        attendingGuests: acc.attendingGuests + s.attendingGuests,
        wishes: acc.wishes + s.totalWishes,
        known: true,
      };
    },
    { submissions: 0, attendingGuests: 0, wishes: 0, known: false },
  );
}
