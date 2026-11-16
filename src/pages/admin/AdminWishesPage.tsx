import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { ExportMenu } from '@/components/shared/ExportMenu';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { useWishFilters } from '@/features/wishes/useWishFilters';
import { useWishActions } from '@/features/wishes/useWishActions';
import { WishFiltersBar } from '@/features/wishes/WishFiltersBar';
import { WishGrid } from '@/features/wishes/WishGrid';
import { useWebsiteDirectory } from '@/features/admin/useDirectories';
import { ALL, WebsiteCustomerFilter } from '@/features/admin/WebsiteCustomerFilter';
import { adminService } from '@/services/admin.service';
import { exportService } from '@/services/export.service';
import { queryKeys } from '@/lib/query';

export function AdminWishesPage() {
  const filters = useWishFilters();
  const directory = useWebsiteDirectory();
  const [scope, setScope] = useState({ websiteId: ALL, customerId: ALL });
  const websiteId = scope.websiteId === ALL ? undefined : scope.websiteId;
  const actions = useWishActions({
    getTimezone: (id) => directory.get(id)?.timezone,
    getWebsiteName: (id) => directory.get(id)?.websiteName,
  });

  const query = { ...filters.query, websiteId };
  const list = useQuery({
    queryKey: queryKeys.admin.wishes(query),
    queryFn: () => adminService.wishes(query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="All Wishes"
        description="Wedding wishes from every website."
        actions={
          <ExportMenu
            datasets={[{ id: 'wishes', label: 'Wedding wishes' }]}
            filtersActive={filters.filtersActive || Boolean(websiteId)}
            onExport={(_, format) =>
              exportService.adminWishes(format, { ...filters.exportFilters, websiteId }, websiteId ? directory.get(websiteId)?.slug : undefined)
            }
          />
        }
      />
      <div className="space-y-4">
        <WishFiltersBar
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
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <WishGrid
            items={list.data?.items ?? []}
            loading={list.isLoading}
            actions={actions}
            timezone={(id) => directory.get(id)?.timezone}
            websiteLabel={(id) => {
              const w = directory.get(id);
              return w ? `${w.websiteName} · /${w.slug}` : 'Unknown website';
            }}
            emptyTitle={filters.filtersActive || websiteId ? 'No wishes match your filters' : 'No wishes yet'}
            emptyDescription="Wishes left on any wedding website appear here."
          />
        )}
        <DataTablePagination
          meta={list.data?.meta}
          page={filters.page}
          pageSize={filters.pageSize}
          onPageChange={filters.setPage}
          onPageSizeChange={filters.setPageSize}
          pageSizeOptions={[12, 24, 48, 96]}
          itemLabel="wishes"
        />
      </div>
      {actions.dialogs}
    </>
  );
}
