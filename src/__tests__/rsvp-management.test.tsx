import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@/test/utils';
import { makeMe, makeRsvp, makeUser, makeWebsite, page } from '@/test/fixtures';
import { customerService } from '@/services/customer.service';
import type { ListQuery } from '@/types/api';

function setup() {
  vi.spyOn(customerService, 'websites').mockResolvedValue([makeWebsite()]);
  const rsvps = vi.spyOn(customerService, 'rsvps').mockResolvedValue(
    page([makeRsvp(), makeRsvp({ id: 'r2', guestName: 'Siti Hassan', attendanceStatus: 'not_attending', numberOfGuests: 1, guestDetails: null, mealPreference: '' })], { totalItems: 2 }),
  );
  return { ...renderApp('/dashboard/rsvps', { me: makeMe(makeUser()) }), rsvps };
}

const lastQuery = (spy: { mock: { calls: unknown[][] } }): ListQuery => spy.mock.calls.at(-1)?.[1] as ListQuery;

describe('RSVP management', () => {
  it('loads the first page with server-side defaults', async () => {
    const { rsvps } = setup();
    expect((await screen.findAllByText('Ahmad Rahman')).length).toBeGreaterThan(0);
    expect(lastQuery(rsvps)).toMatchObject({ page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' });
    expect(screen.getAllByText('Attending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not attending').length).toBeGreaterThan(0);
  });

  it('searches by name with debounce and skips too-short input', async () => {
    const { user, rsvps } = setup();
    await screen.findAllByText('Ahmad Rahman');
    const input = screen.getByRole('searchbox', { name: /search guest name or phone/i });

    await user.type(input, 'a');
    expect(await screen.findByText(/at least 2 letters/i)).toBeInTheDocument();
    expect(rsvps.mock.calls.every((c) => (c[1] as ListQuery).search === undefined)).toBe(true);

    await user.type(input, 'hmad');
    await waitFor(() => expect(lastQuery(rsvps).search).toBe('ahmad'));
    expect(lastQuery(rsvps).page).toBe(1);
  });

  it('searches by phone number (digits only, min 3)', async () => {
    const { user, rsvps } = setup();
    await screen.findAllByText('Ahmad Rahman');
    await user.type(screen.getByRole('searchbox', { name: /search guest name or phone/i }), '+60 12');
    await waitFor(() => expect(lastQuery(rsvps).search).toBe('6012'));
  });

  it('filters by attendance status', async () => {
    const { user, rsvps } = setup();
    await screen.findAllByText('Ahmad Rahman');
    await user.click(screen.getByRole('tab', { name: 'Declined' }));
    await waitFor(() => expect(lastQuery(rsvps).attendanceStatus).toBe('not_attending'));
    await user.click(screen.getByRole('tab', { name: 'Attending' }));
    await waitFor(() => expect(lastQuery(rsvps).attendanceStatus).toBe('attending'));
  });

  it('sorts by column and disables non-date sorts while a date range is active', async () => {
    const { user, rsvps } = setup();
    await screen.findAllByText('Ahmad Rahman');
    const nameSort = screen.getByRole('button', { name: /guest name/i });
    await user.click(nameSort);
    await waitFor(() => expect(lastQuery(rsvps)).toMatchObject({ sortBy: 'guestName', sortOrder: 'asc' }));

    await user.click(screen.getByRole('button', { name: /all time/i }));
    await user.click(await screen.findByRole('button', { name: 'Last 7 days' }));

    await waitFor(() => expect(lastQuery(rsvps)).toMatchObject({ sortBy: 'createdAt' }));
    expect(lastQuery(rsvps).from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(lastQuery(rsvps).to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByRole('button', { name: /guest name/i })).toBeDisabled();
  });

  it('opens the full RSVP detail with guest details', async () => {
    vi.spyOn(customerService, 'rsvp').mockResolvedValue(makeRsvp());
    const { user } = setup();
    const rows = await screen.findAllByText('Ahmad Rahman');
    await user.click(rows[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Guest 3')).toBeInTheDocument();
    expect(within(dialog).getByText('Child')).toBeInTheDocument();
    expect(within(dialog).getByText('No peanuts')).toBeInTheDocument();
    expect(within(dialog).getByText('Arriving early')).toBeInTheDocument();
    expect(within(dialog).getByText('3 people')).toBeInTheDocument();
  });

  it('paginates on the server', async () => {
    vi.spyOn(customerService, 'websites').mockResolvedValue([makeWebsite()]);
    const rsvps = vi
      .spyOn(customerService, 'rsvps')
      .mockResolvedValue(page([makeRsvp()], { totalItems: 45, totalPages: 3, hasNext: true }));
    const { user } = renderApp('/dashboard/rsvps', { me: makeMe(makeUser()) });
    expect(await screen.findByText('1–20 of 45 RSVPs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(lastQuery(rsvps).page).toBe(2));
  });
});
