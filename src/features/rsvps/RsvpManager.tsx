import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/ErrorState';
import { ExportMenu } from '@/components/shared/ExportMenu';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { customerService } from '@/services/customer.service';
import { exportService, type ExportKind } from '@/services/export.service';
import { queryKeys } from '@/lib/query';
import { useRsvpFilters } from './useRsvpFilters';
import { useRsvpActions } from './useRsvpActions';
import { RsvpFiltersBar } from './RsvpFiltersBar';
import { RsvpTable } from './RsvpTable';
import type { WebsiteView } from '@/types/api';

export const RSVP_EXPORT_DATASETS = [
  { id: 'rsvp', label: 'All RSVP submissions' },
  { id: 'attending', label: 'Attending RSVPs', description: 'Confirmed attendees only' },
  { id: 'declined', label: 'Declined RSVPs' },
  { id: 'guests', label: 'Complete guest list', description: 'One row per person' },
  { id: 'attendance', label: 'Attendance summary', description: 'XLSX includes 4 sheets' },
];

interface RsvpManagerProps {
  website: WebsiteView;
}

/** Server-side paginated RSVP table for one website (customer page + admin website detail). */
export function RsvpManager({ website }: RsvpManagerProps) {
  const filters = useRsvpFilters();
  const actions = useRsvpActions({ getWebsite: (id) => (id === website.id ? website : undefined) });

  const list = useQuery({
    queryKey: queryKeys.website.rsvps(website.id, filters.query),
    queryFn: ({ signal }) => customerService.rsvps(website.id, filters.query, signal),
    placeholderData: keepPreviousData,
  });

  const onExport = (datasetId: string, format: 'csv' | 'xlsx') => {
    if (datasetId === 'attendance') {
      return exportService.websiteAttendance(website.id, website.slug, format, {
        from: filters.exportFilters.from,
        to: filters.exportFilters.to,
        search: filters.exportFilters.search,
        attendanceStatus: filters.exportFilters.attendanceStatus,
      });
    }
    return exportService.websiteRsvps(website.id, website.slug, datasetId as ExportKind, format, filters.exportFilters);
  };

  return (
    <>
      <Card className="gap-0 overflow-hidden pb-0">
        <div className="flex flex-col gap-3 px-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">RSVP submissions</h2>
              <p className="text-[13px] text-muted-foreground">
                One row per RSVP form. A form can include several guests.
              </p>
            </div>
            <ExportMenu datasets={RSVP_EXPORT_DATASETS} onExport={onExport} filtersActive={filters.filtersActive} />
          </div>
          <RsvpFiltersBar filters={filters} timezone={website.timezone} />
        </div>

        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} compact className="border-t" />
        ) : (
          <RsvpTable
            items={list.data?.items ?? []}
            loading={list.isLoading}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={filters.toggleSort}
            sortLocked={filters.rangeActive}
            timezone={website.timezone}
            onView={actions.view}
            onEdit={actions.edit}
            onDelete={actions.remove}
            emptyTitle={filters.filtersActive ? 'No RSVPs match your filters' : 'No RSVPs yet'}
            emptyDescription={
              filters.filtersActive
                ? 'Try a different search term, status or date range.'
                : 'RSVP submissions from your wedding website will appear here.'
            }
          />
        )}

        <div className="border-t px-4 sm:px-5">
          <DataTablePagination
            meta={list.data?.meta}
            page={filters.page}
            pageSize={filters.pageSize}
            onPageChange={filters.setPage}
            onPageSizeChange={filters.setPageSize}
            itemLabel="RSVPs"
            disabled={list.isFetching && !list.data}
          />
        </div>
      </Card>
      {actions.dialogs}
    </>
  );
}
