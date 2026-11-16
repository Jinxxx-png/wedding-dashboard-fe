import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authEvents, isApiError, setCsrfToken } from '@/services/api';
import { authService } from '@/services/auth.service';
import type { Role, SessionResponse, UserView } from '@/types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: UserView | null;
  mustChangePassword: boolean;
  sessionExpiresAt: string | null;
  /** Set when the user was signed out by expiry (shown on the login page). */
  expiredReason: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<SessionResponse>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setupPassword: (newPassword: string, confirmPassword: string) => Promise<SessionResponse>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<SessionResponse>;
  refresh: () => Promise<void>;
  updateUser: (user: UserView) => void;
  clearExpiredReason: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL: AuthState = {
  status: 'loading',
  user: null,
  mustChangePassword: false,
  sessionExpiresAt: null,
  expiredReason: null,
};

/** Default landing page for a signed-in user. */
export function homePathFor(user: Pick<UserView, 'role'> | null, mustChangePassword = false): string {
  if (!user) return '/login';
  if (mustChangePassword) return '/setup-password';
  return user.role === 'admin' ? '/admin/dashboard' : '/dashboard';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(INITIAL);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOutLocally = useCallback(
    (reason: string | null) => {
      setCsrfToken(null);
      queryClient.cancelQueries();
      queryClient.clear();
      setState({ ...INITIAL, status: 'unauthenticated', expiredReason: reason });
    },
    [queryClient],
  );

  const applySession = useCallback(
    (user: UserView, mustChangePassword: boolean, expiresAt: string | null) => {
      setState({ status: 'authenticated', user, mustChangePassword, sessionExpiresAt: expiresAt, expiredReason: null });
    },
    [],
  );

  // Initial session probe (cookie is HTTP-only, so ask the server).
  useEffect(() => {
    let cancelled = false;
    authService
      .me()
      .then((me) => {
        if (!cancelled) applySession(me.user, me.mustChangePassword, me.sessionExpiresAt);
      })
      .catch(() => {
        if (!cancelled) setState({ ...INITIAL, status: 'unauthenticated' });
      });
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // Global API events → auth state.
  useEffect(() => {
    authEvents.onUnauthorized = () => {
      signOutLocally('Your session has expired. Please sign in again.');
      toast.error('Your session has expired', { description: 'Please sign in again to continue.' });
    };
    authEvents.onPasswordChangeRequired = () => {
      setState((s) => (s.status === 'authenticated' ? { ...s, mustChangePassword: true } : s));
    };
    return () => {
      authEvents.onUnauthorized = () => {};
      authEvents.onPasswordChangeRequired = () => {};
    };
  }, [signOutLocally]);

  // Client-side session expiry: sign out when the absolute session lifetime ends.
  useEffect(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    if (state.status !== 'authenticated' || !state.sessionExpiresAt) return;
    const ms = new Date(state.sessionExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(ms)) return;
    // setTimeout overflows above ~24.8 days; sessions are 24h so clamp defensively.
    const delay = Math.min(Math.max(ms, 0), 2_000_000_000);
    expiryTimer.current = setTimeout(() => {
      signOutLocally('Your session has expired. Please sign in again.');
    }, delay);
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [state.status, state.sessionExpiresAt, signOutLocally]);

  const login = useCallback(
    async (username: string, password: string) => {
      const session = await authService.login(username, password);
      queryClient.clear();
      applySession(session.user, session.mustChangePassword, session.expiresAt);
      return session;
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* the local session is cleared regardless */
    } finally {
      signOutLocally(null);
    }
  }, [signOutLocally]);

  const logoutAll = useCallback(async () => {
    try {
      await authService.logoutAll();
    } finally {
      signOutLocally(null);
    }
  }, [signOutLocally]);

  const setupPassword = useCallback(
    async (newPassword: string, confirmPassword: string) => {
      const session = await authService.setupPassword(newPassword, confirmPassword);
      queryClient.clear();
      applySession(session.user, session.mustChangePassword, session.expiresAt);
      return session;
    },
    [applySession, queryClient],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
      const session = await authService.changePassword(currentPassword, newPassword, confirmPassword);
      applySession(session.user, session.mustChangePassword, session.expiresAt);
      return session;
    },
    [applySession],
  );

  const refresh = useCallback(async () => {
    try {
      const me = await authService.me();
      applySession(me.user, me.mustChangePassword, me.sessionExpiresAt);
    } catch (error) {
      if (isApiError(error) && error.status === 401) signOutLocally(null);
    }
  }, [applySession, signOutLocally]);

  const updateUser = useCallback((user: UserView) => {
    setState((s) => (s.user ? { ...s, user } : s));
  }, []);

  const clearExpiredReason = useCallback(() => setState((s) => ({ ...s, expiredReason: null })), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      logoutAll,
      setupPassword,
      changePassword,
      refresh,
      updateUser,
      clearExpiredReason,
    }),
    [state, login, logout, logoutAll, setupPassword, changePassword, refresh, updateUser, clearExpiredReason],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useRole(): Role | null {
  return useAuth().user?.role ?? null;
}
