import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ExternalLink, Globe, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/forms/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ActiveBadge } from '@/components/shared/StatusBadges';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { ListSkeleton, TableSkeletonRows } from '@/components/tables/TableSkeleton';
import { CreateWebsiteDialog } from '@/features/admin/CreateWebsiteDialog';
import { useCustomerDirectory, useWebsiteStats } from '@/features/admin/useDirectories';
import { adminService } from '@/services/admin.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDefaultPageSize } from '@/hooks/useDefaultPageSize';
import { queryKeys } from '@/lib/query';
import { formatCalendarDate, formatNumber } from '@/utils/format';

const ALL = '__all__';
const UNASSIGNED_FILTER = '__unassigned__';

export function WebsitesPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim().toLowerCase(), 300);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [owner, setOwner] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(useDefaultPageSize());
  const [createOpen, setCreateOpen] = useState(false);
  const customers = useCustomerDirectory();
  const stats = useWebsiteStats();

  const query = {
    page,
    pageSize,
    search: search || undefined,
    isActive: status === 'all' ? undefined : status === 'active',
    ownerUserId: owner === ALL ? undefined : owner === UNASSIGNED_FILTER ? '' : owner,
  };
  const list = useQuery({
    queryKey: queryKeys.admin.websites(query),
    queryFn: () => adminService.websites(query),
    placeholderData: keepPreviousData,
  });
  const items = list.data?.items ?? [];
  const filtersActive = Boolean(search || status !== 'all' || owner !== ALL);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Websites"
        description="All wedding websites on the platform."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Create website
          </Button>
        }
      />
      <Card className="gap-0 overflow-hidden pb-0">
        <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <SearchInput value={searchInput} onChange={(v) => reset(() => setSearchInput(v))} placeholder="Search by slug…" className="sm:max-w-xs" />
          <Select value={status} onValueChange={(v) => reset(() => setStatus(v as typeof status))}>
            <SelectTrigger className="sm:w-[150px]" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={owner} onValueChange={(v) => reset(() => setOwner(v))}>
            <SelectTrigger className="sm:w-[200px]" aria-label="Owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All owners</SelectItem>
              {customers.customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  @{c.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} compact className="border-t" />
        ) : !list.isLoading && items.length === 0 ? (
          <EmptyState
            icon={Globe}
            className="border-t"
            title={filtersActive ? 'No websites match your filters' : 'No websites yet'}
            description={filtersActive ? 'Try a different slug, status or owner.' : 'Create a website or create a customer with their first website.'}
          />
        ) : (
          <>
            <div className="hidden border-t md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Website</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Wedding date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">RSVPs</TableHead>
                    <TableHead className="text-right">Attending guests</TableHead>
                    <TableHead className="text-right">Wishes</TableHead>
                  </TableRow>
                </TableHeader>
                {list.isLoading ? (
                  <TableSkeletonRows columns={8} />
                ) : (
                  <TableBody>
                    {items.map((w) => {
                      const ownerUser = w.ownerUserId ? customers.byId.get(w.ownerUserId) : undefined;
                      const s = stats.byWebsite.get(w.id);
                      return (
                        <TableRow key={w.id} className="cursor-pointer" onClick={() => navigate(`/admin/websites/${w.id}`)}>
                          <TableCell className="max-w-[240px]">
                            <span className="block truncate font-medium">{w.websiteName}</span>
                            <span className="block truncate text-xs text-muted-foreground">/{w.slug}</span>
                          </TableCell>
                          <TableCell className="max-w-[220px]" onClick={(e) => e.stopPropagation()}>
                            <a href={w.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 text-muted-foreground hover:text-foreground">
                              <span className="truncate">{w.websiteUrl.replace(/^https?:\/\//, '')}</span>
                              <ExternalLink className="size-3 shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell>
                            {w.ownerUserId ? (
                              <Link to={`/admin/customers/${w.ownerUserId}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                                @{ownerUser?.username ?? 'customer'}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatCalendarDate(w.weddingDate)}</TableCell>
                          <TableCell>
                            <ActiveBadge active={w.isActive} />
                          </TableCell>
                          <TableCell className="text-right tabular">{formatNumber(s?.totalSubmissions)}</TableCell>
                          <TableCell className="text-right tabular">{formatNumber(s?.attendingGuests)}</TableCell>
                          <TableCell className="text-right tabular">{formatNumber(s?.totalWishes)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                )}
              </Table>
            </div>
            <div className="border-t md:hidden">
              {list.isLoading ? (
                <ListSkeleton />
              ) : (
                <ul className="divide-y">
                  {items.map((w) => {
                    const s = stats.byWebsite.get(w.id);
                    return (
                      <li key={w.id}>
                        <Link to={`/admin/websites/${w.id}`} className="block space-y-1 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{w.websiteName}</span>
                            <ActiveBadge active={w.isActive} />
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            /{w.slug} · {formatCalendarDate(w.weddingDate)}
                          </p>
                          {s && (
                            <p className="text-xs text-muted-foreground">
                              {formatNumber(s.totalSubmissions)} RSVPs · {formatNumber(s.attendingGuests)} guests
                            </p>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
        <div className="border-t px-4 sm:px-5">
          <DataTablePagination
            meta={list.data?.meta}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => reset(() => setPageSize(s))}
            itemLabel="websites"
          />
        </div>
      </Card>
      <CreateWebsiteDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
