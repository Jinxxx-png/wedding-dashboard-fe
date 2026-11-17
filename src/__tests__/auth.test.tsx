import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp } from '@/test/utils';
import { makeAdmin, makeMe, makeUser, makeWebsite, pending } from '@/test/fixtures';
import { authService } from '@/services/auth.service';
import { adminService } from '@/services/admin.service';
import { customerService } from '@/services/customer.service';
import { ApiError } from '@/services/api';

function stubDashboards() {
  vi.spyOn(customerService, 'websites').mockResolvedValue([makeWebsite()]);
  for (const k of ['dashboard', 'analytics', 'trends', 'rsvps', 'wishes'] as const) vi.spyOn(customerService, k).mockReturnValue(pending() as never);
  for (const k of ['dashboard', 'analytics', 'users', 'rsvps', 'wishes', 'websites'] as const) vi.spyOn(adminService, k).mockReturnValue(pending() as never);
}

describe('Login', () => {
  it('validates required fields before calling the API', async () => {
    const login = vi.spyOn(authService, 'login');
    const { user } = renderApp('/login', { me: null });
    await user.click(await screen.findByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter your username')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('redirects an admin to /admin/dashboard', async () => {
    stubDashboards();
    const admin = makeAdmin();
    vi.spyOn(authService, 'login').mockResolvedValue({ user: admin, csrfToken: 'c', expiresAt: '2099-01-01T00:00:00Z', mustChangePassword: false });
    const { user, router } = renderApp('/login', { me: null });
    await user.type(await screen.findByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'a-long-dev-passphrase');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/dashboard'));
    expect(authService.login).toHaveBeenCalledWith('admin', 'a-long-dev-passphrase');
  });

  it('redirects a customer to /dashboard', async () => {
    stubDashboards();
    vi.spyOn(authService, 'login').mockResolvedValue({ user: makeUser(), csrfToken: 'c', expiresAt: '2099-01-01T00:00:00Z', mustChangePassword: false });
    const { user, router } = renderApp('/login', { me: null });
    await user.type(await screen.findByLabelText('Username'), 'luqman');
    await user.type(screen.getByLabelText('Password'), 'customer-pass-123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('sends users with a temporary password to /setup-password', async () => {
    const pendingUser = makeUser({ accountStatus: 'pending_password_setup', mustChangePassword: true });
    vi.spyOn(authService, 'login').mockResolvedValue({ user: pendingUser, csrfToken: 'c', expiresAt: '2099-01-01T00:00:00Z', mustChangePassword: true });
    const { user, router } = renderApp('/login', { me: null });
    await user.type(await screen.findByLabelText('Username'), 'luqman');
    await user.type(screen.getByLabelText('Password'), 'abacus-ladder-mosaic');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/setup-password'));
    expect(await screen.findByRole('heading', { name: /set your password/i })).toBeInTheDocument();
  });

  it('shows a generic message for invalid credentials', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'invalid username or password'));
    const { user } = renderApp('/login', { me: null });
    await user.type(await screen.findByLabelText('Username'), 'nobody');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Incorrect username or password.')).toBeInTheDocument();
  });
});

describe('Password setup', () => {
  const restricted = () => makeMe(makeUser({ accountStatus: 'pending_password_setup', mustChangePassword: true }), true);

  it('validates minimum length and confirmation client-side', async () => {
    const setup = vi.spyOn(authService, 'setupPassword');
    const { user } = renderApp('/setup-password', { me: restricted() });
    await user.type(await screen.findByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    await user.click(screen.getByRole('button', { name: /set password/i }));
    expect(await screen.findByText('Must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(setup).not.toHaveBeenCalled();
  });

  it('accepts simple passwords: no unique-character or username rules', async () => {
    stubDashboards();
    const setup = vi
      .spyOn(authService, 'setupPassword')
      .mockResolvedValue({ user: makeUser(), csrfToken: 'new', expiresAt: '2099-01-01T00:00:00Z', mustChangePassword: false });
    const { user } = renderApp('/setup-password', { me: restricted() });
    // Contains the username ("luqman"), which used to be rejected; the checklist no longer lists either old rule.
    await user.type(await screen.findByLabelText('New password'), 'luqman1111');
    await user.type(screen.getByLabelText('Confirm new password'), 'luqman1111');
    expect(screen.queryByText(/different characters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contain your username/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /set password/i }));
    await waitFor(() => expect(setup).toHaveBeenCalledWith('luqman1111', 'luqman1111'));
  });

  it('shows backend validation errors under the field', async () => {
    vi.spyOn(authService, 'setupPassword').mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'request validation failed', [{ field: 'newPassword', message: 'is too common' }]),
    );
    const { user } = renderApp('/setup-password', { me: restricted() });
    await user.type(await screen.findByLabelText('New password'), 'river-orange-tiger-77');
    await user.type(screen.getByLabelText('Confirm new password'), 'river-orange-tiger-77');
    await user.click(screen.getByRole('button', { name: /set password/i }));
    expect(await screen.findByText('is too common')).toBeInTheDocument();
  });

  it('continues to the dashboard after a successful setup', async () => {
    stubDashboards();
    vi.spyOn(authService, 'setupPassword').mockResolvedValue({ user: makeUser(), csrfToken: 'new', expiresAt: '2099-01-01T00:00:00Z', mustChangePassword: false });
    const { user, router } = renderApp('/setup-password', { me: restricted() });
    await user.type(await screen.findByLabelText('New password'), 'river-orange-tiger-77');
    await user.type(screen.getByLabelText('Confirm new password'), 'river-orange-tiger-77');
    await user.click(screen.getByRole('button', { name: /set password/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});
