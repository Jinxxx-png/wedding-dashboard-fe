import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import {
  api,
  ApiError,
  apiGet,
  apiPost,
  authEvents,
  markSessionActive,
  parseContentDispositionFilename,
  serializeParams,
  setCsrfToken,
} from '@/services/api';
import { getErrorMessage, getLoginErrorMessage } from '@/utils/errors';

type Reply = { status: number; data: unknown; headers?: Record<string, string> };
const originalAdapter = api.defaults.adapter;

/** Installs a fake transport; `handler` decides the reply for each request. */
function mockTransport(handler: (config: InternalAxiosRequestConfig) => Reply | 'network') {
  const calls: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    calls.push(config);
    const reply = handler(config);
    if (reply === 'network') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    const response: AxiosResponse = { data: reply.data, status: reply.status, statusText: '', headers: reply.headers ?? {}, config, request: {} };
    if (reply.status >= 400) throw new AxiosError('fail', AxiosError.ERR_BAD_REQUEST, config, {}, response);
    return response;
  };
  return calls;
}

const header = (c: InternalAxiosRequestConfig, name: string) => AxiosHeaders.from(c.headers).get(name);

describe('API client', () => {
  beforeEach(() => {
    markSessionActive();
    setCsrfToken(null);
    authEvents.onUnauthorized = vi.fn();
    authEvents.onPasswordChangeRequired = vi.fn();
  });
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('sends credentials and unwraps the { success, data } envelope', async () => {
    const calls = mockTransport(() => ({ status: 200, data: { success: true, data: { hello: 'world' } } }));
    await expect(apiGet('/customer/settings')).resolves.toEqual({ hello: 'world' });
    expect(calls[0]!.withCredentials).toBe(true);
  });

  it('sends the in-memory CSRF token on unsafe methods only', async () => {
    setCsrfToken('tok-123');
    const calls = mockTransport(() => ({ status: 200, data: { success: true, data: {} } }));
    await apiPost('/auth/logout');
    await apiGet('/customer/websites');
    expect(header(calls[0]!, 'X-CSRF-Token')).toBe('tok-123');
    expect(header(calls[1]!, 'X-CSRF-Token')).toBeFalsy();
  });

  it('normalises validation errors into ApiError with field errors', async () => {
    mockTransport(() => ({
      status: 422,
      data: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'request validation failed',
          details: [
            { field: 'newPassword', message: 'must be at least 8 characters' },
            { field: 'newPassword', message: 'is too common' },
          ],
        },
        requestId: 'req-1',
      },
    }));
    const error = await apiPost('/auth/password/setup', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const e = error as ApiError;
    expect(e.status).toBe(422);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.requestId).toBe('req-1');
    expect(e.fieldErrors().newPassword).toContain('at least 8 characters');
    expect(e.fieldErrors().newPassword).toContain('is too common');
  });

  it('maps network failures to a friendly message', async () => {
    mockTransport(() => 'network');
    const error = (await apiGet('/admin/dashboard').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('NETWORK_ERROR');
    expect(getErrorMessage(error)).toMatch(/unable to reach the server/i);
  });

  it('includes Retry-After in rate limit messages', async () => {
    mockTransport(() => ({
      status: 429,
      data: { success: false, error: { code: 'RATE_LIMITED', message: 'slow down' } },
      headers: { 'retry-after': '42' },
    }));
    const error = (await apiPost('/auth/login', {}).catch((e: unknown) => e)) as ApiError;
    expect(error.retryAfter).toBe(42);
    expect(getLoginErrorMessage(error)).toBe('Too many attempts. Try again in 42 seconds.');
  });

  it('does not distinguish unknown users from wrong passwords', () => {
    expect(getLoginErrorMessage(new ApiError(401, 'INVALID_CREDENTIALS', 'invalid'))).toBe('Incorrect username or password.');
    expect(getLoginErrorMessage(new ApiError(403, 'ACCOUNT_DISABLED', 'x'))).toBe('This account has been disabled.');
  });

  it('refreshes a stale CSRF token once and retries the request', async () => {
    setCsrfToken('stale');
    let attempts = 0;
    const calls = mockTransport((c) => {
      if (c.url === '/auth/me') return { status: 200, data: { success: true, data: { csrfToken: 'fresh' } } };
      attempts++;
      if (attempts === 1) return { status: 403, data: { success: false, error: { code: 'CSRF_INVALID', message: 'bad token' } } };
      return { status: 200, data: { success: true, data: { ok: true } } };
    });
    await expect(apiPost('/customer/settings', { displayName: 'x' })).resolves.toEqual({ ok: true });
    const retried = calls.filter((c) => c.url === '/customer/settings');
    expect(retried).toHaveLength(2);
    expect(header(retried[1]!, 'X-CSRF-Token')).toBe('fresh');
  });

  it('fires onUnauthorized once on 401 and stops sending requests after expiry', async () => {
    const calls = mockTransport(() => ({ status: 401, data: { success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } } }));
    await expect(apiGet('/customer/dashboard')).rejects.toBeInstanceOf(ApiError);
    await expect(apiGet('/customer/websites')).rejects.toMatchObject({ status: 401 });
    expect(authEvents.onUnauthorized).toHaveBeenCalledTimes(1);
    // The second request was short-circuited client-side — no network call was made.
    expect(calls).toHaveLength(1);
  });

  it('routes PASSWORD_CHANGE_REQUIRED to the password setup handler', async () => {
    mockTransport(() => ({ status: 403, data: { success: false, error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'x' } } }));
    await expect(apiGet('/customer/dashboard')).rejects.toBeInstanceOf(ApiError);
    expect(authEvents.onPasswordChangeRequired).toHaveBeenCalled();
  });

  it('drops empty query params and parses download filenames safely', () => {
    expect(serializeParams({ page: 1, search: '', status: undefined, from: null, ok: false })).toBe('page=1&ok=false');
    expect(parseContentDispositionFilename('attachment; filename="luqman-amin-rsvp.xlsx"')).toBe('luqman-amin-rsvp.xlsx');
    expect(parseContentDispositionFilename("attachment; filename*=UTF-8''luqman%20amin.csv")).toBe('luqman amin.csv');
    expect(parseContentDispositionFilename('attachment; filename="../../etc/passwd"')).toBe('..-..-etc-passwd');
    expect(parseContentDispositionFilename(null)).toBeNull();
  });
});
