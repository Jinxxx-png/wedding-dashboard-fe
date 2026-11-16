import { apiDelete, apiGet, apiGetPage, apiPatch, apiPut } from './api';
import type {
  AccountSettingsInput,
  Analytics,
  AnalyticsQuery,
  CustomerDashboard,
  ListQuery,
  Paginated,
  Rsvp,
  RsvpInput,
  TrendsResult,
  UserView,
  WebsiteSettingsInput,
  WebsiteView,
  Wish,
  WishUpdateInput,
} from '@/types/api';

const enc = encodeURIComponent;
const site = (websiteId: string) => `/customer/websites/${enc(websiteId)}`;

/**
 * Website-scoped endpoints. Customers can only reach websites they own (others return 404);
 * admins may call these for any website, so admin pages reuse them.
 */
export const customerService = {
  dashboard: (): Promise<CustomerDashboard> => apiGet('/customer/dashboard'),
  websites: (): Promise<WebsiteView[]> => apiGet('/customer/websites'),
  website: (websiteId: string): Promise<WebsiteView> => apiGet(site(websiteId)),
  updateWebsiteSettings: (websiteId: string, body: WebsiteSettingsInput): Promise<WebsiteView> =>
    apiPut(`${site(websiteId)}/settings`, body),

  rsvps: (websiteId: string, query?: ListQuery, signal?: AbortSignal): Promise<Paginated<Rsvp>> =>
    apiGetPage(`${site(websiteId)}/rsvps`, query, { signal }),
  rsvp: (websiteId: string, rsvpId: string): Promise<Rsvp> =>
    apiGet(`${site(websiteId)}/rsvps/${enc(rsvpId)}`),
  updateRsvp: (websiteId: string, rsvpId: string, body: RsvpInput): Promise<Rsvp> =>
    apiPut(`${site(websiteId)}/rsvps/${enc(rsvpId)}`, body),
  deleteRsvp: (websiteId: string, rsvpId: string): Promise<{ deleted: true }> =>
    apiDelete(`${site(websiteId)}/rsvps/${enc(rsvpId)}`),

  wishes: (websiteId: string, query?: ListQuery, signal?: AbortSignal): Promise<Paginated<Wish>> =>
    apiGetPage(`${site(websiteId)}/wishes`, query, { signal }),
  wish: (websiteId: string, wishId: string): Promise<Wish> =>
    apiGet(`${site(websiteId)}/wishes/${enc(wishId)}`),
  updateWish: (websiteId: string, wishId: string, body: WishUpdateInput): Promise<Wish> =>
    apiPatch(`${site(websiteId)}/wishes/${enc(wishId)}`, body),
  deleteWish: (websiteId: string, wishId: string): Promise<{ deleted: true }> =>
    apiDelete(`${site(websiteId)}/wishes/${enc(wishId)}`),

  analytics: (websiteId: string, query?: AnalyticsQuery): Promise<Analytics> =>
    apiGet(`${site(websiteId)}/analytics`, query),
  trends: (websiteId: string, query?: AnalyticsQuery): Promise<TrendsResult> =>
    apiGet(`${site(websiteId)}/analytics/trends`, query),

  settings: (): Promise<UserView> => apiGet('/customer/settings'),
  updateSettings: (body: AccountSettingsInput): Promise<UserView> => apiPut('/customer/settings', body),
};
