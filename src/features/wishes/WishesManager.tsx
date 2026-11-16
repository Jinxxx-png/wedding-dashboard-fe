import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ErrorState } from '@/components/shared/ErrorState';
import { ExportMenu } from '@/components/shared/ExportMenu';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { customerService } from '@/services/customer.service';
import { exportService } from '@/services/export.service';
import { queryKeys } from '@/lib/query';
import { useWishFilters } from './useWishFilters';
import { useWishActions } from './useWishActions';
import { WishFiltersBar } from './WishFiltersBar';
import { WishGrid } from './WishGrid';
import type { WebsiteView } from '@/types/api';

/** Wishes for one website: filters, card grid, moderation and export. */
export function WishesManager({ website, showExport = true }: { website: WebsiteView; showExport?: boolean }) {
  const filters = useWishFilters();
  const actions = useWishActions({ getTimezone: () => website.timezone });
  const pendingApproval = !website.wishSettings.autoApprove;

  const list = useQuery({
    queryKey: queryKeys.website.wishes(website.id, filters.query),
    queryFn: ({ signal }) => customerService.wishes(website.id, filters.query, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      {pendingApproval && (
        <Alert variant="info">
          <Info />
          <AlertDescription>
            Auto-approve is off: new wishes arrive hidden. Review them under “Pending approval” and switch on “Show on
            website” to publish.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <WishFiltersBar
            filters={filters}
            hiddenLabel={pendingApproval ? 'Pending approval' : 'Hidden'}
            timezone={website.timezone}
          />
        </div>
        {showExport && (
          <ExportMenu
            datasets={[{ id: 'wishes', label: 'Wedding wishes' }]}
            onExport={(_, format) => exportService.websiteWishes(website.id, website.slug, format, filters.exportFilters)}
            filtersActive={filters.filtersActive}
          />
        )}
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <WishGrid
          items={list.data?.items ?? []}
          loading={list.isLoading}
          actions={actions}
          timezone={() => website.timezone}
          emptyTitle={filters.filtersActive ? 'No wishes match your filters' : 'No wishes yet'}
          emptyDescription={
            filters.filtersActive
              ? 'Try a different search, view or date range.'
              : 'Messages your guests leave on the wedding website will appear here.'
          }
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
      {actions.dialogs}
    </div>
  );
}
