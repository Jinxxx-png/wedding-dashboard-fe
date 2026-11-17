import { apiGet, apiGetPage, apiPost, apiPut } from './api';
import type {
  AdminDashboard,
  AdminWebsiteUpdate,
  AnalyticsQuery,
  AttendanceSummary,
  AuditLog,
  AuditLogQuery,
  ChangeRoleInput,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateWebsiteInput,
  GlobalAnalytics,
  ListQuery,
  Paginated,
  ResetPasswordResult,
  Rsvp,
  SigningSecretResult,
  UpdateUserInput,
  UserDetail,
  UserListQuery,
  UserView,
  WebsiteListQuery,
  WebsiteView,
  Wish,
} from '@/types/api';

const enc = encodeURIComponent;

/** Admin-only endpoints (`/admin/*`). Customers receive 403 FORBIDDEN. */
export const adminService = {
  dashboard: (): Promise<AdminDashboard> => apiGet('/admin/dashboard'),

  users: (query?: UserListQuery): Promise<Paginated<UserView>> => apiGetPage('/admin/users', query),
  createCustomer: (body: CreateCustomerInput): Promise<CreateCustomerResult> => apiPost('/admin/users', body),
  user: (id: string): Promise<UserDetail> => apiGet(`/admin/users/${enc(id)}`),
  updateUser: (id: string, body: UpdateUserInput): Promise<UserDetail> => apiPut(`/admin/users/${enc(id)}`, body),
  resetPassword: (id: string): Promise<ResetPasswordResult> => apiPost(`/admin/users/${enc(id)}/reset-password`),
  disableUser: (id: string): Promise<UserView> => apiPost(`/admin/users/${enc(id)}/disable`),
  activateUser: (id: string): Promise<UserView> => apiPost(`/admin/users/${enc(id)}/activate`),
  changeRole: (id: string, body: ChangeRoleInput): Promise<UserDetail> => apiPost(`/admin/users/${enc(id)}/role`, body),
  revokeSessions: (id: string): Promise<{ sessionsRevoked: number }> =>
    apiPost(`/admin/users/${enc(id)}/revoke-sessions`),

  websites: (query?: WebsiteListQuery): Promise<Paginated<WebsiteView>> => apiGetPage('/admin/websites', query),
  createWebsite: (body: CreateWebsiteInput): Promise<WebsiteView> => apiPost('/admin/websites', body),
  website: (id: string): Promise<WebsiteView> => apiGet(`/admin/websites/${enc(id)}`),
  updateWebsite: (id: string, body: AdminWebsiteUpdate): Promise<WebsiteView> =>
    apiPut(`/admin/websites/${enc(id)}`, body),
  rotateSigningSecret: (id: string): Promise<SigningSecretResult> =>
    apiPost(`/admin/websites/${enc(id)}/integration/secret`),
  recomputeStats: (id: string): Promise<AttendanceSummary> =>
    apiPost(`/admin/websites/${enc(id)}/analytics/recompute`),

  rsvps: (query?: ListQuery & { websiteId?: string }): Promise<Paginated<Rsvp>> =>
    apiGetPage('/admin/rsvps', query),
  wishes: (query?: ListQuery & { websiteId?: string }): Promise<Paginated<Wish>> =>
    apiGetPage('/admin/wishes', query),
  analytics: (query?: AnalyticsQuery & { websiteId?: string }): Promise<GlobalAnalytics> =>
    apiGet('/admin/analytics', query),
  auditLogs: (query?: AuditLogQuery): Promise<Paginated<AuditLog>> => apiGetPage('/admin/audit-logs', query),
};
