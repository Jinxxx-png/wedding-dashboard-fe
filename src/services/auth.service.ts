import { apiGet, apiPost, markSessionActive, setCsrfToken } from './api';
import type { MeResponse, SessionResponse } from '@/types/api';

/** Applies a fresh session: CSRF token in memory only, requests re-enabled. */
function applySession<T extends { csrfToken: string }>(session: T): T {
  setCsrfToken(session.csrfToken);
  markSessionActive();
  return session;
}

export const authService = {
  async login(username: string, password: string): Promise<SessionResponse> {
    const session = await apiPost<SessionResponse>(
      '/auth/login',
      { username, password },
      { skipSessionGuard: true, silent: true },
    );
    return applySession(session);
  },

  /** Session probe. Silent: a 401 here simply means "not signed in". */
  async me(): Promise<MeResponse> {
    const me = await apiGet<MeResponse>('/auth/me', undefined, { silent: true, skipSessionGuard: true });
    return applySession(me);
  },

  async logout(): Promise<void> {
    try {
      await apiPost('/auth/logout', undefined, { skipSessionGuard: true, silent: true });
    } finally {
      setCsrfToken(null);
    }
  },

  async logoutAll(): Promise<{ sessionsRevoked: number }> {
    try {
      return await apiPost<{ sessionsRevoked: number }>('/auth/logout-all');
    } finally {
      setCsrfToken(null);
    }
  },

  async setupPassword(newPassword: string, confirmPassword: string): Promise<SessionResponse> {
    const session = await apiPost<SessionResponse>('/auth/password/setup', { newPassword, confirmPassword });
    return applySession(session);
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<SessionResponse> {
    const session = await apiPost<SessionResponse>('/auth/password/change', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    return applySession(session);
  },
};
