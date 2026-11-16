import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { customerService } from '@/services/customer.service';
import { queryKeys } from '@/lib/query';
import type { WebsiteView } from '@/types/api';

/**
 * Selected wedding website for the customer area. The selection lives in the URL
 * (`?site=<websiteId>`) so it survives reloads and can be shared/bookmarked.
 * The backend still enforces ownership — an unowned id simply returns 404.
 */
interface WebsiteContextValue {
  websites: WebsiteView[];
  website: WebsiteView | null;
  websiteId: string | null;
  setWebsiteId: (id: string) => void;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  /** `?site=<id>` for building links that keep the selection. */
  linkSearch: string;
}

const WebsiteContext = createContext<WebsiteContextValue | null>(null);

export const SITE_PARAM = 'site';

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: queryKeys.customer.websites, queryFn: customerService.websites });

  const websites = useMemo(() => query.data ?? [], [query.data]);
  const requested = params.get(SITE_PARAM);
  const website = websites.find((w) => w.id === requested) ?? websites[0] ?? null;

  const setWebsiteId = useCallback(
    (id: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(SITE_PARAM, id);
          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const value = useMemo<WebsiteContextValue>(
    () => ({
      websites,
      website,
      websiteId: website?.id ?? null,
      setWebsiteId,
      isLoading: query.isLoading,
      error: query.error,
      refetch: () => void query.refetch(),
      linkSearch: website && websites.length > 1 ? `?${SITE_PARAM}=${encodeURIComponent(website.id)}` : '',
    }),
    [websites, website, setWebsiteId, query.isLoading, query.error, query.refetch],
  );

  return <WebsiteContext.Provider value={value}>{children}</WebsiteContext.Provider>;
}

export function useWebsites(): WebsiteContextValue {
  const ctx = useContext(WebsiteContext);
  if (!ctx) throw new Error('useWebsites must be used within WebsiteProvider');
  return ctx;
}

/** For pages rendered inside the customer layout once a website is resolved. */
export function useSelectedWebsite(): WebsiteView {
  const { website } = useWebsites();
  if (!website) throw new Error('No website selected');
  return website;
}
