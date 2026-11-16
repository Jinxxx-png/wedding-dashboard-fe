import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp, renderWithProviders } from '@/test/utils';
import { makeMe, makeRsvp, makeUser, makeWebsite, page } from '@/test/fixtures';
import { ExportMenu } from '@/components/shared/ExportMenu';
import { buildExportFilename, exportService } from '@/services/export.service';
import { customerService } from '@/services/customer.service';
import * as apiModule from '@/services/api';
import { api, ApiError } from '@/services/api';

describe('Export controls', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds meaningful filenames', () => {
    expect(buildExportFilename('luqman-amin', 'rsvp', 'xlsx')).toBe('luqman-amin-rsvp.xlsx');
    expect(buildExportFilename('luqman-amin', 'rsvp', 'csv')).toBe('luqman-amin-rsvp.csv');
    expect(buildExportFilename('luqman-amin', 'attendance', 'xlsx')).toBe('luqman-amin-attendance.xlsx');
    expect(buildExportFilename('luqman-amin', 'wishes', 'csv')).toBe('luqman-amin-wishes.csv');
    expect(buildExportFilename('', 'guests', 'csv')).toBe('wedding-project-guests.csv');
  });

  it('downloads Excel and CSV from a single-dataset menu with loading feedback', async () => {
    let resolve!: (v: string) => void;
    const onExport = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const { user } = renderWithProviders(<ExportMenu datasets={[{ id: 'wishes', label: 'Wedding wishes' }]} onExport={onExport} />);
    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(await screen.findByRole('menuitem', { name: /download csv/i }));
    expect(onExport).toHaveBeenCalledWith('wishes', 'csv');
    expect(await screen.findByRole('button', { name: /exporting/i })).toBeDisabled();
    resolve('luqman-amin-wishes.csv');
    expect(await screen.findByText('Downloaded luqman-amin-wishes.csv')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /^export$/i })).toBeEnabled());
  });

  it('reports export errors from the backend (e.g. row limit)', async () => {
    const onExport = vi.fn().mockRejectedValue(new ApiError(422, 'VALIDATION_ERROR', 'export exceeds 50,000 rows; narrow your filters'));
    const { user } = renderWithProviders(<ExportMenu datasets={[{ id: 'rsvp', label: 'All RSVPs' }]} onExport={onExport} />);
    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(await screen.findByRole('menuitem', { name: /download excel/i }));
    expect(await screen.findByText('Export failed')).toBeInTheDocument();
    expect(screen.getByText(/narrow your filters/i)).toBeInTheDocument();
  });

  it('sends the selected type, format and current filters to the backend', async () => {
    const download = vi.spyOn(apiModule, 'apiDownload').mockResolvedValue('file.xlsx');
    await exportService.websiteRsvps('w1', 'luqman-amin', 'attending', 'csv', {
      page: 3,
      pageSize: 50,
      search: 'ahmad',
      attendanceStatus: 'not_attending',
      from: '2026-11-01',
      to: '2026-11-10',
    });
    expect(download).toHaveBeenCalledWith(
      '/customer/websites/w1/export/rsvps',
      { search: 'ahmad', from: '2026-11-01', to: '2026-11-10', format: 'csv', type: 'attending' },
      'luqman-amin-rsvp-attending.csv',
    );
  });

  it('triggers a browser download using the server filename', async () => {
    const original = api.defaults.adapter;
    api.defaults.adapter = async (config) => ({
      data: new Blob(['a,b']),
      status: 200,
      statusText: 'OK',
      headers: { 'content-disposition': 'attachment; filename="luqman-amin-wishes.csv"' },
      config,
      request: {},
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    apiModule.markSessionActive();
    const name = await exportService.websiteWishes('w1', 'luqman-amin', 'csv', { search: 'siti' });
    expect(name).toBe('luqman-amin-wishes.csv');
    expect(click).toHaveBeenCalled();
    api.defaults.adapter = original;
  });

  it('exports the RSVP list with the active filters from the RSVP page', async () => {
    vi.spyOn(customerService, 'websites').mockResolvedValue([makeWebsite()]);
    vi.spyOn(customerService, 'rsvps').mockResolvedValue(page([makeRsvp()]));
    const exportSpy = vi.spyOn(exportService, 'websiteRsvps').mockResolvedValue('luqman-amin-rsvp.xlsx');
    const { user } = renderApp('/dashboard/rsvps', { me: makeMe(makeUser()) });
    await screen.findAllByText('Ahmad Rahman');
    await user.click(screen.getByRole('tab', { name: 'Attending' }));
    await user.click(screen.getByRole('button', { name: /^export$/i }));
    await user.click(await screen.findByRole('menuitem', { name: /all rsvp submissions/i }));
    await waitFor(() =>
      expect(exportSpy).toHaveBeenCalledWith('w1', 'luqman-amin', 'rsvp', 'xlsx', expect.objectContaining({ attendanceStatus: 'attending' })),
    );
  });
});
