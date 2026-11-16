import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@/test/utils';
import { makeAnalytics, makeMe, makeSummary, makeUser, makeWebsite, page } from '@/test/fixtures';
import { customerService } from '@/services/customer.service';
import type { CustomerDashboard } from '@/types/api';

const w1 = makeWebsite({ id: 'w1', websiteName: 'Luqman & Amin', slug: 'luqman-amin' });
const w2 = makeWebsite({ id: 'w2', websiteName: 'Luqman & Amin — Reception', slug: 'luqman-amin-reception' });

function stubCustomer(websites = [w1, w2]) {
  vi.spyOn(customerService, 'websites').mockResolvedValue(websites);
  vi.spyOn(customerService, 'dashboard').mockResolvedValue({
    user: makeUser(),
    totals: makeSummary(),
    websites: websites.map((website) => ({ website, summary: makeSummary(), daysUntilWedding: 38 })),
    trends: [],
  } satisfies CustomerDashboard);
  vi.spyOn(customerService, 'analytics').mockImplementation(async (websiteId) =>
    websiteId === 'w2'
      ? makeAnalytics({ websiteId, summary: makeSummary({ totalSubmissions: 12, attendingSubmissions: 9, declinedSubmissions: 3, attendingGuests: 27 }) })
      : makeAnalytics({ websiteId }),
  );
  vi.spyOn(customerService, 'trends').mockResolvedValue({ granularity: 'day', from: '', to: '', points: [] });
  vi.spyOn(customerService, 'rsvps').mockResolvedValue(page([]));
  vi.spyOn(customerService, 'wishes').mockResolvedValue(page([]));
}

const kpi = (testId: string) => within(screen.getByTestId(testId)).getByText((_, el) => el?.getAttribute('data-slot') === 'stat-value');

describe('Customer analytics', () => {
  it('shows RSVP submissions and attending guests as separate figures from the API', async () => {
    stubCustomer([w1]);
    renderApp('/dashboard', { me: makeMe(makeUser()) });

    await waitFor(() => expect(kpi('kpi-total-submissions')).toHaveTextContent('100'));
    expect(kpi('kpi-attending-submissions')).toHaveTextContent('80');
    expect(kpi('kpi-declined-submissions')).toHaveTextContent('20');
    // 185 attending *guests* — not the 80 attending submissions.
    expect(kpi('kpi-attending-guests')).toHaveTextContent('185');
    expect(kpi('kpi-total-wishes')).toHaveTextContent('42');

    const summary = screen.getByTestId('attendance-summary');
    expect(within(summary).getByText('Expected attendees')).toBeInTheDocument();
    expect(within(summary).getByText('80%')).toBeInTheDocument();
    expect(within(summary).getByText('From 80 attending RSVP forms')).toBeInTheDocument();
    expect(customerService.analytics).toHaveBeenCalledWith('w1', { from: undefined, to: undefined });
  });

  it('renders empty states instead of blank charts when there is no data', async () => {
    stubCustomer([w1]);
    vi.spyOn(customerService, 'analytics').mockResolvedValue(
      makeAnalytics({
        summary: makeSummary({ totalSubmissions: 0, attendingSubmissions: 0, declinedSubmissions: 0, attendingGuests: 0, declinedGuests: 0, expectedAttendees: 0, totalWishes: 0 }),
        attendingVsDeclined: {
          attending: { submissions: 0, guests: 0, submissionsPercentage: 0, guestsPercentage: 0 },
          declined: { submissions: 0, guests: 0, submissionsPercentage: 0, guestsPercentage: 0 },
        },
        guestBreakdown: { totalAttendingGuests: 0, adults: 0, children: 0, infants: 0, unspecified: 0 },
        mealPreferences: [],
        dietaryRequirements: [],
      }),
    );
    renderApp('/dashboard', { me: makeMe(makeUser()) });
    expect(await screen.findByText('No RSVP submissions in this period')).toBeInTheDocument();
    expect(screen.getByText('No attending guests yet')).toBeInTheDocument();
    expect(screen.getByText('No meal preferences recorded')).toBeInTheDocument();
  });
});

describe('Website selector', () => {
  it('lists every owned website and reloads data when switching', async () => {
    stubCustomer();
    const { user, router } = renderApp('/dashboard', { me: makeMe(makeUser({ websiteIds: ['w1', 'w2'] })) });

    const selector = await screen.findByRole('button', { name: /select website/i });
    expect(selector).toHaveTextContent('Luqman & Amin');
    await waitFor(() => expect(kpi('kpi-total-submissions')).toHaveTextContent('100'));

    await user.click(selector);
    await user.click(await screen.findByRole('menuitem', { name: /reception/i }));

    await waitFor(() => expect(router.state.location.search).toBe('?site=w2'));
    await waitFor(() => expect(kpi('kpi-total-submissions')).toHaveTextContent('12'));
    expect(customerService.analytics).toHaveBeenCalledWith('w2', { from: undefined, to: undefined });
    expect(kpi('kpi-attending-guests')).toHaveTextContent('27');
  });

  it('does not show a dropdown for a single website', async () => {
    stubCustomer([w1]);
    renderApp('/dashboard', { me: makeMe(makeUser()) });
    expect(await screen.findByTestId('website-current')).toHaveTextContent('Luqman & Amin');
    expect(screen.queryByRole('button', { name: /select website/i })).not.toBeInTheDocument();
  });

  it('honours the website id in the URL', async () => {
    stubCustomer();
    renderApp('/dashboard?site=w2', { me: makeMe(makeUser({ websiteIds: ['w1', 'w2'] })) });
    expect(await screen.findByRole('button', { name: /select website/i })).toHaveTextContent('Reception');
    await waitFor(() => expect(customerService.analytics).toHaveBeenCalledWith('w2', expect.anything()));
    expect(customerService.analytics).not.toHaveBeenCalledWith('w1', expect.anything());
  });
});
