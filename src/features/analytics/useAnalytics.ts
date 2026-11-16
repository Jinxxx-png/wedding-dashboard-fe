import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { customerService } from '@/services/customer.service';
import { adminService } from '@/services/admin.service';
import { queryKeys } from '@/lib/query';
import type { DateRange } from '@/components/forms/DateRangeFilter';
import type { Granularity } from '@/types/api';

export function useWebsiteAnalytics(websiteId: string, range: DateRange) {
  const q = { from: range.from, to: range.to };
  return useQuery({
    queryKey: queryKeys.website.analytics(websiteId, q),
    queryFn: () => customerService.analytics(websiteId, q),
    placeholderData: keepPreviousData,
  });
}

export function useWebsiteTrends(websiteId: string, granularity: Granularity, range: DateRange) {
  const q = { granularity, from: range.from, to: range.to };
  return useQuery({
    queryKey: queryKeys.website.trends(websiteId, q),
    queryFn: () => customerService.trends(websiteId, q),
    placeholderData: keepPreviousData,
  });
}

export function useGlobalAnalytics(granularity: Granularity, range: DateRange, websiteId?: string) {
  const q = { granularity, from: range.from, to: range.to, websiteId };
  return useQuery({
    queryKey: queryKeys.admin.analytics(q),
    queryFn: () => adminService.analytics(q),
    placeholderData: keepPreviousData,
  });
}
