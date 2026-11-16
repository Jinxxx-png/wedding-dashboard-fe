import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import type { ApiFailure, ApiSuccess, FieldError, PageMeta, Paginated } from '@/types/api';

/**
 * Central HTTP client for the Wedding Project Golang REST API.
 *
 * - Session: HTTP-only cookie (`wp_session`) → `withCredentials: true`. JS never sees the token.
 * - CSRF: token kept in memory only and sent as `X-CSRF-Token` on unsafe methods.
 *   A stale token (CSRF_INVALID) is refreshed via `/auth/me` and the request retried once.
 * - 401: clears in-memory auth state, notifies the app once, and short-circuits further
 *   requests until the user signs in again (no request storms after expiry).
 * - 403 PASSWORD_CHANGE_REQUIRED: notifies the app so it can route to /setup-password.
 */

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Do not fire global auth events (used for the initial session probe). */
    silent?: boolean;
    /** Allow the request even after the session has expired (login, session probe, logout). */
    skipSessionGuard?: boolean;
    /** Internal: request already retried after a CSRF refresh. */
    _csrfRetried?: boolean;
  }
}

const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: FieldError[];
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    details: FieldError[] = [],
    requestId?: string,
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }

  /** `{ "guestDetails[1].name": "is required", ... }` — first message per field. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) {
      out[d.field] = out[d.field] ? `${out[d.field]}; ${d.message}` : d.message;
    }
    return out;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// ---------------------------------------------------------------------------
// In-memory auth state shared with the AuthContext
// ---------------------------------------------------------------------------

let csrfToken: string | null = null;
let sessionExpired = false;

export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};
export const getCsrfToken = () => csrfToken;

/** Called after a successful login / session probe to re-enable requests. */
export const markSessionActive = () => {
  sessionExpired = false;
};
export const isSessionExpired = () => sessionExpired;

type AuthEventHandlers = {
  onUnauthorized: () => void;
  onPasswordChangeRequired: () => void;
};

/** Wired up by AuthProvider. */
export const authEvents: AuthEventHandlers = {
  onUnauthorized: () => {},
  onPasswordChangeRequired: () => {},
};

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

/** Drops undefined / null / empty-string params (the backend treats "" as invalid input). */
export function serializeParams(params: Record<string, unknown> | undefined): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }
  return qs.toString();
}

export const api: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 60_000,
  headers: { Accept: 'application/json' },
  paramsSerializer: { serialize: (params) => serializeParams(params as Record<string, unknown>) },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (sessionExpired && !config.skipSessionGuard) {
    return Promise.reject(
      new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.'),
    );
  }
  const method = (config.method ?? 'get').toLowerCase();
  if (UNSAFE_METHODS.has(method) && csrfToken) {
    config.headers = AxiosHeaders.from(config.headers);
    config.headers.set('X-CSRF-Token', csrfToken);
  }
  return config;
});

async function readErrorBody(data: unknown): Promise<Partial<ApiFailure> | null> {
  if (!data) return null;
  try {
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      const text = await data.text();
      return text ? (JSON.parse(text) as Partial<ApiFailure>) : null;
    }
    if (typeof data === 'string') return JSON.parse(data) as Partial<ApiFailure>;
    if (typeof data === 'object') return data as Partial<ApiFailure>;
  } catch {
    /* non-JSON body */
  }
  return null;
}

/** Converts any thrown value from axios into an ApiError with a user-presentable message. */
export async function toApiError(error: unknown): Promise<ApiError> {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const res = error.response;
    if (!res) {
      if (error.code === AxiosError.ECONNABORTED || error.code === 'ETIMEDOUT') {
        return new ApiError(0, 'TIMEOUT', 'The request timed out. Please try again.');
      }
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'Unable to reach the server. Check your connection and try again.',
      );
    }
    const body = await readErrorBody(res.data);
    const headers = res.headers as Record<string, string | undefined>;
    const retryAfterRaw = headers['retry-after'];
    const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : undefined;
    return new ApiError(
      res.status,
      body?.error?.code ?? fallbackCode(res.status),
      body?.error?.message ?? fallbackMessage(res.status),
      body?.error?.details ?? [],
      body?.requestId ?? headers['x-request-id'],
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }
  return new ApiError(0, 'UNKNOWN', error instanceof Error ? error.message : 'Unexpected error');
}

function fallbackCode(status: number): string {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'UNKNOWN';
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return "You don't have access to this resource.";
  if (status === 404) return 'The requested resource was not found.';
  if (status === 503) return 'Service temporarily unavailable. Please retry.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'Request failed.';
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isCancel(error)) throw error;
    const apiError = await toApiError(error);
    const config = axios.isAxiosError(error) ? error.config : undefined;
    const method = (config?.method ?? 'get').toLowerCase();

    // Stale CSRF token (e.g. session rotated in another tab) → refresh once and retry.
    if (
      config &&
      apiError.code === 'CSRF_INVALID' &&
      UNSAFE_METHODS.has(method) &&
      !config._csrfRetried
    ) {
      try {
        const me = await api.get<ApiSuccess<{ csrfToken: string }>>('/auth/me', {
          silent: true,
          skipSessionGuard: true,
        });
        csrfToken = me.data.data.csrfToken;
        return await api.request({ ...config, _csrfRetried: true });
      } catch {
        /* fall through to the original error */
      }
    }

    if (!config?.silent) {
      if (apiError.status === 401) {
        csrfToken = null;
        if (!sessionExpired) {
          sessionExpired = true;
          authEvents.onUnauthorized();
        }
      } else if (apiError.code === 'PASSWORD_CHANGE_REQUIRED') {
        authEvents.onPasswordChangeRequired();
      }
    }

    if (env.isDev && apiError.requestId) {
      // Only non-sensitive identifiers are logged (never bodies, passwords or tokens).
      console.warn(`[api] ${apiError.code} (${apiError.status}) requestId=${apiError.requestId}`);
    }
    throw apiError;
  },
);

// ---------------------------------------------------------------------------
// Typed helpers (unwrap the `{ success, data, meta }` envelope)
// ---------------------------------------------------------------------------

type Params = object;

export async function apiGet<T>(
  path: string,
  params?: Params,
  options: { silent?: boolean; skipSessionGuard?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await api.get<ApiSuccess<T>>(path, { params, ...options });
  return res.data.data;
}

export async function apiGetPage<T>(
  path: string,
  params?: Params,
  options: { signal?: AbortSignal } = {},
): Promise<Paginated<T>> {
  const res = await api.get<ApiSuccess<T[]>>(path, { params, ...options });
  const items = res.data.data ?? [];
  const meta: PageMeta = res.data.meta ?? {
    page: 1,
    pageSize: items.length,
    totalItems: items.length,
    totalPages: 1,
    hasNext: false,
  };
  return { items, meta };
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options: { skipSessionGuard?: boolean; silent?: boolean } = {},
): Promise<T> {
  const res = await api.post<ApiSuccess<T>>(path, body, options);
  return res.data.data;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await api.put<ApiSuccess<T>>(path, body);
  return res.data.data;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await api.patch<ApiSuccess<T>>(path, body);
  return res.data.data;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await api.delete<ApiSuccess<T>>(path);
  return res.data.data;
}

// ---------------------------------------------------------------------------
// File downloads
// ---------------------------------------------------------------------------

/** Extracts the filename from a Content-Disposition header (supports RFC 5987 `filename*`). */
export function parseContentDispositionFilename(header: string | undefined | null): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)?''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return sanitizeFilename(decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')));
    } catch {
      /* ignore malformed encoding */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain?.[1] ? sanitizeFilename(plain[1].trim()) : null;
}

function sanitizeFilename(name: string): string {
  // Never allow path segments from a header to influence the saved location.
  return name.replace(/[\\/]+/g, '-').replace(/[\u0000-\u001f]/g, '').trim();
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Requests a backend-generated export (CSV/XLSX) and triggers a browser download.
 * Prefers the server-provided filename; falls back to `fallbackFilename`.
 * Returns the filename that was used.
 */
export async function apiDownload(
  path: string,
  params: Params | undefined,
  fallbackFilename: string,
): Promise<string> {
  const res: AxiosResponse<Blob> = await api.get(path, {
    params,
    responseType: 'blob',
    headers: { Accept: '*/*' },
  });
  const headers = res.headers as Record<string, string | undefined>;
  const filename = parseContentDispositionFilename(headers['content-disposition']) ?? fallbackFilename;
  saveBlob(res.data, filename);
  return filename;
}
