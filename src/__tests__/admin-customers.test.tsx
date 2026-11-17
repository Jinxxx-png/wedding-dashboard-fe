import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@/test/utils';
import { makeAdmin, makeMe, makeSummary, makeUser, makeWebsite, page } from '@/test/fixtures';
import { adminService } from '@/services/admin.service';
import { ApiError } from '@/services/api';
import type { GlobalAnalytics } from '@/types/api';

const customer = makeUser({ id: 'u1', username: 'luqman', websiteIds: ['w1'] });
const website = makeWebsite({ id: 'w1', ownerUserId: 'u1' });

function stubAdmin() {
  vi.spyOn(adminService, 'users').mockResolvedValue(page([customer]));
  vi.spyOn(adminService, 'websites').mockResolvedValue(page([website]));
  vi.spyOn(adminService, 'analytics').mockResolvedValue({
    websites: [{ websiteId: 'w1', slug: website.slug, websiteName: website.websiteName, ownerUserId: 'u1', isActive: true, summary: makeSummary() }],
  } as unknown as GlobalAnalytics);
}

const fillCreateForm = async (user: ReturnType<typeof renderApp>['user'], { withWebsite = false } = {}) => {
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText(/^username/i), 'sarah');
  if (withWebsite) {
    await user.click(within(dialog).getByRole('switch', { name: /create a wedding website now/i }));
    await user.type(within(dialog).getByLabelText(/^website name/i), 'Ahmad & Sarah');
    const url = within(dialog).getByLabelText(/^website url/i);
    await user.clear(url);
    await user.type(url, 'https://ahmad-sarah.com');
  }
  return dialog;
};

describe('Admin customer management', () => {
  it('lists customers with their website and stats', async () => {
    stubAdmin();
    renderApp('/admin/customers', { me: makeMe(makeAdmin()) });
    expect((await screen.findAllByText('@luqman')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText('Luqman & Amin').length).toBeGreaterThan(0));
    expect(adminService.users).toHaveBeenCalledWith(expect.objectContaining({ role: 'customer', page: 1 }));
    expect(screen.getAllByText('185').length).toBeGreaterThan(0);
  });

  it('creates a customer without a website by default', async () => {
    stubAdmin();
    const create = vi.spyOn(adminService, 'createCustomer').mockResolvedValue({
      user: makeUser({ id: 'u9', username: 'sarah', websiteIds: [], accountStatus: 'pending_password_setup', mustChangePassword: true }),
      temporaryPassword: 'abacus-ladder-mosaic-velvet-orbit-prism-harbor-quill',
      temporaryPasswordExpiresAt: '2026-11-18T00:00:00Z',
    });
    const { user } = renderApp('/admin/customers', { me: makeMe(makeAdmin()) });
    await user.click(await screen.findByRole('button', { name: /create customer/i }));
    const dialog = await fillCreateForm(user);
    expect(within(dialog).queryByLabelText(/^website name/i)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /create customer/i }));

    // Only the account fields are sent (the API rejects unknown or partial website fields).
    await waitFor(() => expect(create).toHaveBeenCalledWith({ username: 'sarah' }));
    expect(await screen.findByTestId('one-time-secret')).toHaveTextContent('abacus-ladder-mosaic');
    expect(screen.getByText('Not assigned yet')).toBeInTheDocument();
  });

  it('only validates the website fields while the website switch is on', async () => {
    stubAdmin();
    const create = vi.spyOn(adminService, 'createCustomer').mockResolvedValue({
      user: makeUser({ id: 'u9', username: 'sarah', websiteIds: [] }),
      temporaryPassword: 'abacus-ladder-mosaic-velvet-orbit-prism-harbor-quill',
      temporaryPasswordExpiresAt: '2026-11-18T00:00:00Z',
    });
    const { user } = renderApp('/admin/customers', { me: makeMe(makeAdmin()) });
    await user.click(await screen.findByRole('button', { name: /create customer/i }));
    const dialog = await fillCreateForm(user);
    const toggle = within(dialog).getByRole('switch', { name: /create a wedding website now/i });
    await user.click(toggle);
    await user.click(within(dialog).getByRole('button', { name: /create customer/i }));
    expect(await within(dialog).findByText('Website name is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await user.click(toggle);
    await user.click(within(dialog).getByRole('button', { name: /create customer/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ username: 'sarah' }));
  });

  it('creates a customer with a website and shows the temporary password exactly once', async () => {
    stubAdmin();
    const create = vi.spyOn(adminService, 'createCustomer').mockResolvedValue({
      user: makeUser({ id: 'u9', username: 'sarah', accountStatus: 'pending_password_setup', mustChangePassword: true }),
      website: makeWebsite({ id: 'w9', slug: 'ahmad-sarah', websiteName: 'Ahmad & Sarah' }),
      temporaryPassword: 'abacus-ladder-mosaic-velvet-orbit-prism-harbor-quill',
      temporaryPasswordExpiresAt: '2026-11-18T00:00:00Z',
    });
    const { user } = renderApp('/admin/customers', { me: makeMe(makeAdmin()) });
    await user.click(await screen.findByRole('button', { name: /create customer/i }));
    const dialog = await fillCreateForm(user, { withWebsite: true });
    // Slug is derived from the website name until edited.
    expect(within(dialog).getByLabelText(/^website slug/i)).toHaveValue('ahmad-sarah');
    await user.click(within(dialog).getByRole('button', { name: /create customer/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        username: 'sarah',
        websiteName: 'Ahmad & Sarah',
        websiteSlug: 'ahmad-sarah',
        websiteUrl: 'https://ahmad-sarah.com',
      }),
    );
    const secret = await screen.findByTestId('one-time-secret');
    expect(screen.getByText('/ahmad-sarah')).toBeInTheDocument();
    expect(secret).toHaveTextContent('abacus-ladder-mosaic-velvet-orbit-prism-harbor-quill');
    expect(screen.getByText('This will only be shown once')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();

    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /i have copied it/i }));
    await user.click(done);
    await waitFor(() => expect(screen.queryByTestId('one-time-secret')).not.toBeInTheDocument());
    expect(screen.queryByText(/abacus-ladder-mosaic/)).not.toBeInTheDocument();
    // Never persisted to browser storage.
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('abacus');
  });

  it('maps a taken username to the form field', async () => {
    stubAdmin();
    vi.spyOn(adminService, 'createCustomer').mockRejectedValue(new ApiError(409, 'USERNAME_TAKEN', 'username is already taken'));
    const { user } = renderApp('/admin/customers', { me: makeMe(makeAdmin()) });
    await user.click(await screen.findByRole('button', { name: /create customer/i }));
    const dialog = await fillCreateForm(user);
    await user.click(within(dialog).getByRole('button', { name: /create customer/i }));
    expect(await within(dialog).findByText('username is already taken')).toBeInTheDocument();
  });

  it('resets a password after confirmation and shows the new temporary password', async () => {
    stubAdmin();
    const reset = vi.spyOn(adminService, 'resetPassword').mockResolvedValue({
      user: customer,
      temporaryPassword: 'cobalt-ember-willow-summit-canvas-falcon-garnet-juniper',
      temporaryPasswordExpiresAt: '2026-11-18T00:00:00Z',
    });
    const { user } = renderApp('/admin/customers', { me: makeMe(makeAdmin()) });
    const actions = await screen.findAllByRole('button', { name: /actions for luqman/i });
    await user.click(actions[0]!);
    await user.click(await screen.findByRole('menuitem', { name: /reset password/i }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/must choose a new password/i)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Reset password' }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith('u1'));
    expect(await screen.findByTestId('one-time-secret')).toHaveTextContent('cobalt-ember-willow');
    expect(screen.getByText(/must set a new password the next time they sign in/i)).toBeInTheDocument();
  });

  it('disables an account after confirmation', async () => {
    stubAdmin();
    const disable = vi.spyOn(adminService, 'disableUser').mockResolvedValue({ ...customer, accountStatus: 'disabled' });
    const { user } = renderApp('/admin/customers', { me: makeMe(makeAdmin()) });
    const actions = await screen.findAllByRole('button', { name: /actions for luqman/i });
    await user.click(actions[0]!);
    await user.click(await screen.findByRole('menuitem', { name: /disable account/i }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Disable account' }));
    await waitFor(() => expect(disable).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('luqman has been disabled')).toBeInTheDocument();
  });
});
