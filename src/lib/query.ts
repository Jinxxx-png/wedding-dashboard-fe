import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/services/api';
import type {
  AnalyticsQuery,
  AuditLogQuery,
  ListQuery,
  UserListQuery,
  WebsiteListQuery,
} from '@/types/api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Never retry client errors (401/403/404/422...) — they won't change by retrying.
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

/** Centralised query keys. Everything for one website lives under ['website', id]. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  customer: {
    all: ['customer'] as const,
    dashboard: ['customer', 'dashboard'] as const,
    websites: ['customer', 'websites'] as const,
    settings: ['customer', 'settings'] as const,
  },
  website: {
    all: (id: string) => ['website', id] as const,
    detail: (id: string) => ['website', id, 'detail'] as const,
    analytics: (id: string, q: AnalyticsQuery) => ['website', id, 'analytics', q] as const,
    trends: (id: string, q: AnalyticsQuery) => ['website', id, 'trends', q] as const,
    rsvps: (id: string, q: ListQuery) => ['website', id, 'rsvps', q] as const,
    rsvp: (id: string, rsvpId: string) => ['website', id, 'rsvp', rsvpId] as const,
    wishes: (id: string, q: ListQuery) => ['website', id, 'wishes', q] as const,
  },
  admin: {
    all: ['admin'] as const,
    dashboard: ['admin', 'dashboard'] as const,
    analytics: (q: AnalyticsQuery & { websiteId?: string }) => ['admin', 'analytics', q] as const,
    users: (q: UserListQuery) => ['admin', 'users', q] as const,
    user: (id: string) => ['admin', 'user', id] as const,
    websites: (q: WebsiteListQuery) => ['admin', 'websites', q] as const,
    website: (id: string) => ['admin', 'website', id] as const,
    websiteDirectory: ['admin', 'website-directory'] as const,
    customerDirectory: ['admin', 'customer-directory'] as const,
    rsvps: (q: ListQuery & { websiteId?: string }) => ['admin', 'rsvps', q] as const,
    wishes: (q: ListQuery & { websiteId?: string }) => ['admin', 'wishes', q] as const,
    auditLogs: (q: AuditLogQuery) => ['admin', 'audit-logs', q] as const,
  },
};
