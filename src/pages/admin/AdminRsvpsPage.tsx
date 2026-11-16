import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { ExportMenu } from '@/components/shared/ExportMenu';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { useRsvpFilters } from '@/features/rsvps/useRsvpFilters';
import { useRsvpActions } from '@/features/rsvps/useRsvpActions';
import { RsvpFiltersBar } from '@/features/rsvps/RsvpFiltersBar';
import { RsvpTable } from '@/features/rsvps/RsvpTable';
import { useWebsiteDirectory } from '@/features/admin/useDirectories';
import { ALL, WebsiteCustomerFilter } from '@/features/admin/WebsiteCustomerFilter';
import { adminService } from '@/services/admin.service';
import { exportService, type ExportKind } from '@/services/export.service';
import { queryKeys } from '@/lib/query';

const DATASETS = [
  { id: 'rsvp', label: 'All RSVP submissions' },
  { id: 'attending', label: 'Attending RSVPs' },
  { id: 'declined', label: 'Declined RSVPs' },
  { id: 'guests', label: 'Complete guest list', description: 'One row per person' },
];

export function AdminRsvpsPage() {
  const filters = useRsvpFilters();
  const directory = useWebsiteDirectory();
  const [scope, setScope] = useState({ websiteId: ALL, customerId: ALL });
  const websiteId = scope.websiteId === ALL ? undefined : scope.websiteId;
  const actions = useRsvpActions({ getWebsite: directory.get });

  const query = { ...filters.query, websiteId };
  const list = useQuery({
    queryKey: queryKeys.admin.rsvps(query),
    queryFn: () => adminService.rsvps(query),
    placeholderData: keepPreviousData,
  });

  const label = (id: string) => {
    const w = directory.get(id);
    return w ? { name: w.websiteName, slug: w.slug, timezone: w.timezone } : undefined;
  };

  return (
    <>
      <PageHeader title="All RSVPs" description="RSVP submissions across every wedding website." />
      <Card className="gap-0 overflow-hidden pb-0">
        <div className="flex flex-col gap-3 px-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">RSVP submissions</h2>
              <p className="text-[13px] text-muted-foreground">Each row shows the website it belongs to.</p>
            </div>
            <ExportMenu
              datasets={DATASETS}
              filtersActive={filters.filtersActive || Boolean(websiteId)}
              onExport={(id, format) =>
                exportService.adminRsvps(id as ExportKind, format, { ...filters.exportFilters, websiteId }, websiteId ? directory.get(websiteId)?.slug : undefined)
              }
            />
          </div>
          <RsvpFiltersBar
            filters={filters}
            extra={
              <WebsiteCustomerFilter
                websiteId={scope.websiteId}
                customerId={scope.customerId}
                onChange={(next) => {
                  setScope(next);
                  filters.setPage(1);
                }}
              />
            }
          />
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
            websiteLabel={label}
            onView={actions.view}
            onEdit={actions.edit}
            onDelete={actions.remove}
            emptyTitle={filters.filtersActive || websiteId ? 'No RSVPs match your filters' : 'No RSVPs yet'}
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
          />
        </div>
      </Card>
      {actions.dialogs}
    </>
  );
}
