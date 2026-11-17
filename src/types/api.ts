/**
 * TypeScript interfaces matching the documented Wedding Project REST API contract
 * (FRONTEND_DASHBOARD_GUIDE.md §3). Keep these in sync with the backend OpenAPI spec.
 */

export type Role = 'admin' | 'customer';
export type AccountStatus = 'active' | 'disabled' | 'pending_password_setup';
export type AttendanceStatus = 'attending' | 'not_attending';
export type GuestType = 'adult' | 'child' | 'infant';
export type DuplicatePolicy = 'update' | 'reject' | 'allow';
export type IntegrationMode = 'browser' | 'signed';
export type Granularity = 'day' | 'week' | 'month';
export type ExportFormat = 'csv' | 'xlsx';

// ---- Envelope ----
export interface FieldError {
  field: string;
  message: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: FieldError[] };
  requestId?: string;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

// ---- Users ----
export interface UserSettings {
  displayName: string;
  /** IANA, e.g. "Asia/Kuala_Lumpur" ("" if unset) */
  timezone: string;
  defaultExportFormat: '' | ExportFormat;
  /** 0 if unset */
  defaultPageSize: number;
}

export interface UserView {
  id: string;
  username: string;
  role: Role;
  accountStatus: AccountStatus;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt?: string;
  websiteIds: string[];
  settings: UserSettings;
  /** Temporarily locked after failed logins */
  isLocked: boolean;
  lockedUntil?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserDetail extends UserView {
  websites: WebsiteView[];
}

// ---- Websites ----
export interface RsvpSettings {
  acceptingRsvps: boolean;
  /** RFC 3339 */
  rsvpDeadline?: string;
  maxGuestsPerRsvp: number;
  mealOptions: string[];
  duplicatePolicy: DuplicatePolicy;
  requirePhone: boolean;
}

export interface WishSettings {
  acceptingWishes: boolean;
  autoApprove: boolean;
}

export interface IntegrationView {
  mode: IntegrationMode;
  allowedOrigins: string[];
  captchaRequired: boolean;
  signingKeyId?: string;
  /** The secret itself is never returned again */
  hasSigningSecret: boolean;
  secretRotatedAt?: string;
}

export interface WebsiteView {
  id: string;
  /** "" = unassigned */
  ownerUserId: string;
  slug: string;
  websiteName: string;
  websiteUrl: string;
  /** YYYY-MM-DD */
  weddingDate?: string;
  timezone: string;
  isActive: boolean;
  rsvpSettings: RsvpSettings;
  wishSettings: WishSettings;
  integration: IntegrationView;
  createdAt: string;
  updatedAt: string;
}

// ---- RSVPs & wishes ----
export interface GuestDetail {
  name: string;
  type: GuestType;
}

export interface Rsvp {
  id: string;
  websiteId: string;
  guestName: string;
  phoneNumber: string;
  attendanceStatus: AttendanceStatus;
  /** Total people INCLUDING the main guest */
  numberOfGuests: number;
  /** May be empty/null → treat as [] */
  guestDetails: GuestDetail[] | null;
  /** "" when none / declined */
  mealPreference: string;
  dietaryRequirements: string;
  /** May contain newlines */
  notes: string;
  source: 'browser' | 'server' | 'dashboard';
  createdAt: string;
  updatedAt: string;
}

export interface Wish {
  id: string;
  websiteId: string;
  senderName: string;
  /** Plain text, may contain newlines — render as text, never as HTML */
  message: string;
  isVisible: boolean;
  isFavourite: boolean;
  source: 'browser' | 'server';
  createdAt: string;
  updatedAt: string;
}

export type AuditTargetType = 'user' | 'website' | 'rsvp' | 'wish' | 'session' | 'export';

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorUsername: string;
  actorRole: Role | '';
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  requestId: string;
  createdAt: string;
}

// ---- Analytics ----
export interface AttendanceSummary {
  /** RSVP forms received */
  totalSubmissions: number;
  attendingSubmissions: number;
  declinedSubmissions: number;
  /** People attending (sum of numberOfGuests) */
  attendingGuests: number;
  declinedGuests: number;
  /** = attendingGuests */
  expectedAttendees: number;
  totalWishes: number;
  /** attendingSubmissions / totalSubmissions * 100 (2 dp) */
  attendancePercentage: number;
  guestAttendancePercentage: number;
  averageGuestsPerAttendingRsvp: number;
}

export interface AttendanceSplitItem {
  submissions: number;
  guests: number;
  submissionsPercentage: number;
  guestsPercentage: number;
}

export interface GuestBreakdown {
  totalAttendingGuests: number;
  adults: number;
  children: number;
  infants: number;
  unspecified: number;
}

export interface BreakdownItem {
  key: string;
  submissions: number;
  guests: number;
}

export interface TrendPoint {
  /** "2026-11-10" | "2026-W46" | "2026-11" */
  period: string;
  startDate: string;
  endDate: string;
  submissions: number;
  attending: number;
  declined: number;
  attendingGuests: number;
  declinedGuests: number;
  wishes: number;
}

export interface Analytics {
  websiteId?: string;
  /** Only present when a date range was requested */
  from?: string;
  to?: string;
  granularity: Granularity;
  summary: AttendanceSummary;
  attendingVsDeclined: { attending: AttendanceSplitItem; declined: AttendanceSplitItem };
  guestBreakdown: GuestBreakdown;
  /** Keys = meal options + "unspecified"; attending only */
  mealPreferences: BreakdownItem[];
  dietaryRequirements: BreakdownItem[];
  trends: TrendPoint[];
}

export interface TrendsResult {
  websiteId?: string;
  granularity: Granularity;
  from: string;
  to: string;
  points: TrendPoint[];
}

export interface WebsiteSummary {
  websiteId: string;
  slug: string;
  websiteName: string;
  ownerUserId: string;
  isActive: boolean;
  weddingDate?: string;
  summary: AttendanceSummary;
}

export interface GlobalAnalytics extends Analytics {
  websites: WebsiteSummary[];
}

// ---- Dashboards ----
export interface CustomerDashboardWebsite {
  website: WebsiteView;
  summary: AttendanceSummary;
  /** Negative after the wedding */
  daysUntilWedding?: number;
}

export interface CustomerDashboard {
  user: UserView;
  totals: AttendanceSummary;
  websites: CustomerDashboardWebsite[];
  /** Last 30 days, daily */
  trends: TrendPoint[];
}

export interface UserCounts {
  total: number;
  admins: number;
  customers: number;
  active: number;
  disabled: number;
  pendingPasswordSetup: number;
}

export interface AdminDashboard {
  users: UserCounts;
  websites: { total: number; active: number };
  totals: AttendanceSummary;
  /** ≤ 10, by submissions */
  topWebsites: WebsiteSummary[];
  /** ≤ 10 */
  recentAuditLogs: AuditLog[];
  /** Last 30 days, all websites */
  trends: TrendPoint[];
}

// ---- Auth / admin results ----
export interface SessionResponse {
  user: UserView;
  csrfToken: string;
  expiresAt: string;
  mustChangePassword: boolean;
}

export interface MeResponse {
  user: UserView;
  csrfToken: string;
  sessionExpiresAt: string;
  mustChangePassword: boolean;
}

export interface CreateCustomerResult {
  user: UserView;
  /** Absent (or null) when the customer was created without a website. */
  website?: WebsiteView | null;
  temporaryPassword: string;
  temporaryPasswordExpiresAt: string;
}

export interface ResetPasswordResult {
  user: UserView;
  temporaryPassword: string;
  temporaryPasswordExpiresAt: string;
}

export interface SigningSecretResult {
  websiteId: string;
  keyId: string;
  secret: string;
  rotatedAt: string;
}

// ---- Query params ----
export type RsvpSortBy = 'createdAt' | 'guestName' | 'numberOfGuests';
export type SortOrder = 'asc' | 'desc';

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  attendanceStatus?: AttendanceStatus;
  from?: string;
  to?: string;
  sortBy?: RsvpSortBy;
  sortOrder?: SortOrder;
  /** Wishes only */
  isVisible?: boolean;
  /** Wishes only */
  isFavourite?: boolean;
}

export interface AnalyticsQuery {
  from?: string;
  to?: string;
  granularity?: Granularity;
}

export type RsvpExportType = 'all' | 'attending' | 'declined' | 'guests';

export interface ExportQuery extends ListQuery {
  format?: ExportFormat;
  type?: RsvpExportType;
}

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  role?: Role;
  accountStatus?: AccountStatus;
  search?: string;
}

export interface WebsiteListQuery {
  page?: number;
  pageSize?: number;
  ownerUserId?: string;
  isActive?: boolean;
  search?: string;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  actorUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

// ---- Request bodies ----
export interface RsvpInput {
  guestName: string;
  phoneNumber?: string;
  attendanceStatus: AttendanceStatus;
  numberOfGuests?: number;
  /** Length must equal numberOfGuests */
  guestDetails?: { name: string; type?: GuestType }[];
  /** Must be one of the website's mealOptions */
  mealPreference?: string;
  dietaryRequirements?: string;
  notes?: string;
}

export interface RsvpSettingsInput {
  acceptingRsvps: boolean;
  /** RFC 3339, "" clears it */
  rsvpDeadline: string;
  maxGuestsPerRsvp: number;
  mealOptions: string[];
  duplicatePolicy: DuplicatePolicy;
  requirePhone: boolean;
}

export interface WebsiteSettingsInput {
  rsvpSettings?: Partial<RsvpSettingsInput>;
  wishSettings?: Partial<WishSettings>;
}

export interface AccountSettingsInput {
  displayName?: string;
  timezone?: string;
  defaultExportFormat?: ExportFormat;
  defaultPageSize?: number;
}

/**
 * Website fields are all-or-nothing: send websiteName + websiteSlug + websiteUrl (and optionally weddingDate)
 * to create the first website too, or none of them to create the account only.
 */
export interface CreateCustomerInput {
  username: string;
  displayName?: string;
  timezone?: string;
  websiteName?: string;
  websiteSlug?: string;
  websiteUrl?: string;
  weddingDate?: string;
}

export interface UpdateUserInput {
  username?: string;
  displayName?: string;
  websiteIds?: string[];
}

export interface CreateWebsiteInput {
  websiteName: string;
  slug: string;
  websiteUrl: string;
  ownerUserId?: string;
  weddingDate?: string;
  timezone?: string;
  isActive?: boolean;
}

export interface AdminWebsiteUpdate {
  websiteName?: string;
  slug?: string;
  websiteUrl?: string;
  /** "" clears */
  weddingDate?: string;
  timezone?: string;
  isActive?: boolean;
  /** "" unassigns */
  ownerUserId?: string;
  rsvpSettings?: Partial<RsvpSettingsInput>;
  wishSettings?: Partial<WishSettings>;
  integration?: { mode?: IntegrationMode; allowedOrigins?: string[]; captchaRequired?: boolean };
}

export interface WishUpdateInput {
  isVisible?: boolean;
  isFavourite?: boolean;
}
