import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';

/**
 * After RSVP / wish mutations the backend updates counters and analytics immediately,
 * so refetch everything derived from that website (lists, analytics, dashboards).
 */
export function useInvalidateWebsiteData() {
  const queryClient = useQueryClient();
  return useCallback(
    (websiteId: string) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.website.all(websiteId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customer.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
      ]),
    [queryClient],
  );
}
