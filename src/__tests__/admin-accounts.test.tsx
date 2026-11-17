import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@/test/utils';
import { makeAdmin, makeMe, makeUser, makeWebsite, page } from '@/test/fixtures';
import { adminService } from '@/services/admin.service';
import { ApiError } from '@/services/api';
import type { UserListQuery } from '@/types/api';

const me = makeAdmin({ id: 'admin1', username: 'admin' });
const otherAdmin = makeAdmin({ id: 'admin2', username: 'aina.ops' });
const customer = makeUser({ id: 'u1', username: 'luqman', websiteIds: ['w1'] });
const website = makeWebsite({ id: 'w1', ownerUserId: 'u1', websiteName: 'Luqman & Amin', slug: 'luqman-amin' });

function stubAccounts() {
  const users = vi.spyOn(adminService, 'users').mockImplementation(async (q?: UserListQuery) => {
    const all = [me, otherAdmin, customer];
    return page(q?.role ? all.filter((u) => u.role === q.role) : all);
  });
  vi.spyOn(adminService, 'websites').mockResolvedValue(page([website]));
  return { users };
}

const openActionsFor = async (user: ReturnType<typeof renderApp>['user'], username: string) => {
  const buttons = await screen.findAllByRole('button', { name: new RegExp(`actions for ${username.replace('.', '\\.')}`, 'i') });
  await user.click(buttons[0]!);
};

describe('Admin accounts page', () => {
  it('lists admins and customers together with their roles', async () => {
    const { users } = stubAccounts();
    renderApp('/admin/accounts', { me: makeMe(me) });
    expect((await screen.findAllByText('@luqman')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('@aina.ops').length).toBeGreaterThan(0);
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    // No role filter by default: the backend returns every account.
    expect(users).toHaveBeenCalledWith(expect.objectContaining({ page: 1, role: undefined }));
    expect(screen.getAllByRole('link', { name: /^accounts$/i }).length).toBeGreaterThan(0);
  });

  it('filters by role', async () => {
    const { users } = stubAccounts();
    const { user } = renderApp('/admin/accounts', { me: makeMe(me) });
    await screen.findAllByText('@luqman');
    await user.click(screen.getByRole('radio', { name: 'Admins' }));
    await waitFor(() => expect(users).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin', page: 1 })));
    await waitFor(() => expect(screen.queryAllByText('@luqman')).toHaveLength(0));
  });

  it('promotes a customer to admin after warning that their websites become unassigned', async () => {
    stubAccounts();
    const change = vi
      .spyOn(adminService, 'changeRole')
      .mockResolvedValue({ ...customer, role: 'admin', websiteIds: [], websites: [] });
    const { user } = renderApp('/admin/accounts', { me: makeMe(me) });
    await openActionsFor(user, 'luqman');
    await user.click(await screen.findByRole('menuitem', { name: /make admin/i }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText('Make @luqman an admin?')).toBeInTheDocument();
    expect(within(confirm).getByText(/will become\s+unassigned/i)).toBeInTheDocument();
    expect(await within(confirm).findByText('Luqman & Amin')).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Make admin' }));
    await waitFor(() => expect(change).toHaveBeenCalledWith('u1', { role: 'admin' }));
    expect(await screen.findByText('@luqman is now an admin')).toBeInTheDocument();
  });

  it('changes another admin to a customer', async () => {
    stubAccounts();
    const change = vi
      .spyOn(adminService, 'changeRole')
      .mockResolvedValue({ ...otherAdmin, role: 'customer', websites: [] });
    const { user } = renderApp('/admin/accounts', { me: makeMe(me) });
    await openActionsFor(user, 'aina.ops');
    await user.click(await screen.findByRole('menuitem', { name: /make customer/i }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).queryByText(/unassigned/i)).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Make customer' }));
    await waitFor(() => expect(change).toHaveBeenCalledWith('admin2', { role: 'customer' }));
  });

  it('shows the backend reason when a role change is refused and keeps the dialog open', async () => {
    stubAccounts();
    vi.spyOn(adminService, 'changeRole').mockRejectedValue(
      new ApiError(409, 'LAST_ADMIN', 'at least one active admin must remain'),
    );
    const { user } = renderApp('/admin/accounts', { me: makeMe(me) });
    await openActionsFor(user, 'aina.ops');
    await user.click(await screen.findByRole('menuitem', { name: /make customer/i }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Make customer' }));
    expect(await screen.findByText('at least one active admin must remain')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('does not offer role, password or disable actions on your own account', async () => {
    stubAccounts();
    const { user } = renderApp('/admin/accounts', { me: makeMe(me) });
    await openActionsFor(user, 'admin');
    expect(await screen.findByRole('menuitem', { name: /edit details/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /make customer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /reset password/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /disable account/i })).not.toBeInTheDocument();
    expect(screen.getByText(/can’t change your own role/i)).toBeInTheDocument();
  });
});
