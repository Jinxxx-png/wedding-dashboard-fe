import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { AuthLayout } from '@/layouts/AuthLayout';
import { CustomerLayout } from '@/layouts/CustomerLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { GuestOnly, RequireAuth, RequirePasswordSetup, RequireRole, RootRedirect } from './guards';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SetupPasswordPage } from '@/pages/auth/SetupPasswordPage';
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { RouteErrorBoundary } from '@/pages/errors/RouteErrorBoundary';

/** Lazy-load a named page export (keeps the initial bundle small). */
function page<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T): ReactNode {
  const Component = lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/', element: <RootRedirect /> },
      {
        element: <AuthLayout />,
        children: [
          { element: <GuestOnly />, children: [{ path: '/login', element: <LoginPage /> }] },
          { element: <RequirePasswordSetup />, children: [{ path: '/setup-password', element: <SetupPasswordPage /> }] },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireRole role="customer" />,
            children: [
              {
                path: '/dashboard',
                element: <CustomerLayout />,
                children: [
                  { index: true, element: page(() => import('@/pages/customer/OverviewPage'), 'OverviewPage') },
                  { path: 'rsvps', element: page(() => import('@/pages/customer/RsvpsPage'), 'RsvpsPage') },
                  { path: 'wishes', element: page(() => import('@/pages/customer/WishesPage'), 'WishesPage') },
                  { path: 'guests', element: page(() => import('@/pages/customer/GuestsPage'), 'GuestsPage') },
                  // Account pages stay reachable for customers who have no website assigned yet.
                  {
                    path: 'settings',
                    handle: { websiteOptional: true },
                    element: page(() => import('@/pages/customer/SettingsPage'), 'SettingsPage'),
                  },
                  {
                    path: 'change-password',
                    handle: { websiteOptional: true },
                    element: page(() => import('@/pages/customer/ChangePasswordPage'), 'ChangePasswordPage'),
                  },
                ],
              },
            ],
          },
          {
            element: <RequireRole role="admin" />,
            children: [
              {
                path: '/admin',
                element: <AdminLayout />,
                children: [
                  { index: true, element: <Navigate to="/admin/dashboard" replace /> },
                  { path: 'dashboard', element: page(() => import('@/pages/admin/AdminOverviewPage'), 'AdminOverviewPage') },
                  { path: 'customers', element: page(() => import('@/pages/admin/CustomersPage'), 'CustomersPage') },
                  {
                    path: 'customers/:userId',
                    element: page(() => import('@/pages/admin/CustomerDetailPage'), 'CustomerDetailPage'),
                  },
                  { path: 'websites', element: page(() => import('@/pages/admin/WebsitesPage'), 'WebsitesPage') },
                  {
                    path: 'websites/:websiteId',
                    element: page(() => import('@/pages/admin/WebsiteDetailPage'), 'WebsiteDetailPage'),
                  },
                  { path: 'rsvps', element: page(() => import('@/pages/admin/AdminRsvpsPage'), 'AdminRsvpsPage') },
                  { path: 'wishes', element: page(() => import('@/pages/admin/AdminWishesPage'), 'AdminWishesPage') },
                  { path: 'audit-logs', element: page(() => import('@/pages/admin/AuditLogsPage'), 'AuditLogsPage') },
                  { path: 'settings', element: page(() => import('@/pages/admin/AdminSettingsPage'), 'AdminSettingsPage') },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
