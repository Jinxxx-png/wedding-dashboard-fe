import { Navigate, Outlet, useLocation } from 'react-router';
import { homePathFor, useAuth } from '@/contexts/AuthContext';
import { FullScreenLoader } from '@/components/shared/FullScreenLoader';
import type { Role } from '@/types/api';

/** Requires a fully set-up session. Restricted sessions are sent to /setup-password. */
export function RequireAuth() {
  const { status, user, mustChangePassword } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (mustChangePassword) return <Navigate to="/setup-password" replace />;
  return <Outlet />;
}

/** Role gate. Users with the wrong role are sent to their own home page. */
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}

/** Only for restricted sessions that must set a new password first. */
export function RequirePasswordSetup() {
  const { status, user, mustChangePassword } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'unauthenticated' || !user) return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}

/** Login page: signed-in users go straight to their dashboard. */
export function GuestOnly() {
  const { status, user, mustChangePassword } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated' && user) return <Navigate to={homePathFor(user, mustChangePassword)} replace />;
  return <Outlet />;
}

export function RootRedirect() {
  const { status, user, mustChangePassword } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  return <Navigate to={homePathFor(user, mustChangePassword)} replace />;
}
