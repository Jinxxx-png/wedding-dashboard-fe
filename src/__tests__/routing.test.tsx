import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@/test/utils';
import { makeAdmin, makeMe, makeUser, makeWebsite, pending } from '@/test/fixtures';
import { adminService } from '@/services/admin.service';
import { customerService } from '@/services/customer.service';

function stubAll() {
  vi.spyOn(customerService, 'websites').mockResolvedValue([makeWebsite()]);
  for (const k of ['dashboard', 'analytics', 'trends', 'rsvps', 'wishes', 'settings'] as const) vi.spyOn(customerService, k).mockReturnValue(pending() as never);
  for (const k of ['dashboard', 'analytics', 'users', 'rsvps', 'wishes', 'websites', 'auditLogs'] as const) vi.spyOn(adminService, k).mockReturnValue(pending() as never);
}

describe('Protected routes', () => {
  it('sends unauthenticated visitors to the login page', async () => {
    const { router } = renderApp('/dashboard/rsvps', { me: null });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('blocks dashboards until a temporary password is replaced', async () => {
    const me = makeMe(makeUser({ mustChangePassword: true, accountStatus: 'pending_password_setup' }), true);
    const { router } = renderApp('/dashboard', { me });
    await waitFor(() => expect(router.state.location.pathname).toBe('/setup-password'));
  });

  it('keeps customers out of the admin area', async () => {
    stubAll();
    const { router } = renderApp('/admin/customers', { me: makeMe(makeUser()) });
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(adminService.users).not.toHaveBeenCalled();
  });

  it('sends admins from the customer area to the admin dashboard', async () => {
    stubAll();
    const { router } = renderApp('/dashboard', { me: makeMe(makeAdmin()) });
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/dashboard'));
  });

  it('redirects signed-in users away from the login page', async () => {
    stubAll();
    const { router } = renderApp('/login', { me: makeMe(makeUser()) });
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});

describe('Role-based navigation', () => {
  it('shows the admin sidebar to admins', async () => {
    stubAll();
    renderApp('/admin/dashboard', { me: makeMe(makeAdmin()) });
    const nav = await screen.findByRole('complementary', { name: 'Primary' });
    for (const label of ['Overview', 'Customers', 'Websites', 'All RSVPs', 'All Wishes', 'Audit Logs', 'Settings']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(nav).queryByRole('link', { name: 'RSVP Management' })).not.toBeInTheDocument();
  });

  it('shows the customer sidebar to customers', async () => {
    stubAll();
    renderApp('/dashboard', { me: makeMe(makeUser()) });
    const nav = await screen.findByRole('complementary', { name: 'Primary' });
    for (const label of ['Overview', 'RSVP Management', 'Wedding Wishes', 'Guest Management', 'Settings']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(nav).queryByRole('link', { name: 'Audit Logs' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Customers' })).not.toBeInTheDocument();
  });
});
