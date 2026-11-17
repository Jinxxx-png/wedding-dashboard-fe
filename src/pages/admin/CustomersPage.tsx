import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Ban, CheckCircle2, Eye, KeyRound, LogOut, MoreHorizontal, Pencil, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/forms/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { AccountStatusBadge, LockedBadge } from '@/components/shared/StatusBadges';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { ListSkeleton, TableSkeletonRows } from '@/components/tables/TableSkeleton';
import { CreateCustomerDialog } from '@/features/admin/CreateCustomerDialog';
import { EditCustomerDialog } from '@/features/admin/EditCustomerDialog';
import { useCustomerActions } from '@/features/admin/useCustomerActions';
import { sumSummaries, useWebsiteDirectory, useWebsiteStats } from '@/features/admin/useDirectories';
import { adminService } from '@/services/admin.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDefaultPageSize } from '@/hooks/useDefaultPageSize';
import { queryKeys } from '@/lib/query';
import { formatDate, formatNumber } from '@/utils/format';
import type { AccountStatus, UserDetail, UserView } from '@/types/api';

type StatusFilter = 'all' | AccountStatus;

export function CustomersPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(useDefaultPageSize());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserDetail | null>(null);
  const actions = useCustomerActions();
  const directory = useWebsiteDirectory();
  const stats = useWebsiteStats();

  const query = {
    page,
    pageSize,
    role: 'customer' as const,
    search: search || undefined,
    accountStatus: status === 'all' ? undefined : status,
  };
  const list = useQuery({
    queryKey: queryKeys.admin.users(query),
    queryFn: () => adminService.users(query),
    placeholderData: keepPreviousData,
  });

  const openEdit = async (u: UserView) => {
    const detail = await adminService.user(u.id).catch(() => null);
    if (detail) setEditing(detail);
  };

  const rowActions = (u: UserView) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.username}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => navigate(`/admin/customers/${u.id}`)}>
          <Eye /> View customer
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void openEdit(u)}>
          <Pencil /> Edit customer
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.resetPassword(u)}>
          <KeyRound /> Reset password
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.revokeSessions(u)}>
          <LogOut /> Revoke sessions
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {u.accountStatus === 'disabled' ? (
          <DropdownMenuItem onSelect={() => actions.activate(u)}>
            <CheckCircle2 /> Activate account
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem variant="destructive" onSelect={() => actions.disable(u)}>
            <Ban /> Disable account
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const items = list.data?.items ?? [];
  const filtersActive = Boolean(search || status !== 'all');

  return (
    <>
      <PageHeader
        title="Customers"
        description="Customer accounts, their wedding websites and activity."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Create customer
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden pb-0">
        <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:items-center sm:px-5">
          <SearchInput
            value={searchInput}
            onChange={(v) => {
              setSearchInput(v);
              setPage(1);
            }}
            placeholder="Search by username…"
            className="sm:max-w-xs"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-[190px]" aria-label="Account status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending_password_setup">Pending setup</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} compact className="border-t" />
        ) : !list.isLoading && items.length === 0 ? (
          <EmptyState
            icon={Users}
            className="border-t"
            title={filtersActive ? 'No customers match your filters' : 'No customers yet'}
            description={filtersActive ? 'Try a different username or status.' : 'Create the first customer account to get started.'}
            action={
              !filtersActive && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus /> Create customer
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden border-t md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Username</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">RSVPs</TableHead>
                    <TableHead className="text-right">Attending guests</TableHead>
                    <TableHead className="text-right">Wishes</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                {list.isLoading ? (
                  <TableSkeletonRows columns={8} />
                ) : (
                  <TableBody>
                    {items.map((u) => {
                      const sites = u.websiteIds.map((id) => directory.get(id)).filter(Boolean);
                      const first = sites[0];
                      const totals = sumSummaries(u.websiteIds, stats.byWebsite);
                      return (
                        <TableRow key={u.id} className="cursor-pointer" onClick={() => navigate(`/admin/customers/${u.id}`)}>
                          <TableCell>
                            <Link to={`/admin/customers/${u.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                              @{u.username}
                            </Link>
                            {u.settings.displayName && <p className="text-xs text-muted-foreground">{u.settings.displayName}</p>}
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            {first ? (
                              <>
                                <span className="block truncate">{first.websiteName}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  /{first.slug} · {first.websiteUrl.replace(/^https?:\/\//, '')}
                                </span>
                                {sites.length > 1 && <span className="text-xs text-muted-foreground">+{sites.length - 1} more</span>}
                              </>
                            ) : u.websiteIds.length > 0 && directory.isLoading ? (
                              <span className="text-muted-foreground">Loading…</span>
                            ) : (
                              <span className="text-muted-foreground">No website</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <AccountStatusBadge status={u.accountStatus} />
                              {u.isLocked && <LockedBadge />}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular">{formatDate(u.createdAt)}</TableCell>
                          <TableCell className="text-right tabular">{totals.known ? formatNumber(totals.submissions) : '—'}</TableCell>
                          <TableCell className="text-right tabular">{totals.known ? formatNumber(totals.attendingGuests) : '—'}</TableCell>
                          <TableCell className="text-right tabular">{totals.known ? formatNumber(totals.wishes) : '—'}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>{rowActions(u)}</TableCell>
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
                  {items.map((u) => {
                    const first = u.websiteIds.map((id) => directory.get(id)).find(Boolean);
                    const totals = sumSummaries(u.websiteIds, stats.byWebsite);
                    return (
                      <li key={u.id} className="flex items-start gap-3 px-4 py-3">
                        <Link to={`/admin/customers/${u.id}`} className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">@{u.username}</span>
                            <AccountStatusBadge status={u.accountStatus} />
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{first ? `${first.websiteName} · /${first.slug}` : 'No website'}</p>
                          {totals.known && (
                            <p className="text-xs text-muted-foreground">
                              {formatNumber(totals.submissions)} RSVPs · {formatNumber(totals.attendingGuests)} guests · {formatNumber(totals.wishes)} wishes
                            </p>
                          )}
                        </Link>
                        {rowActions(u)}
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
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            itemLabel="customers"
          />
        </div>
      </Card>

      <CreateCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(result) => {
          setCreateOpen(false);
          const site = result.website;
          actions.showSecret({
            title: 'Customer created',
            description: site
              ? `The account and the website “${site.websiteName}” are ready. The customer must set their own password on first sign-in.`
              : 'The account is ready, with no website yet — assign one later from Edit customer. The customer must set their own password on first sign-in.',
            details: [
              { label: 'Username', value: result.user.username },
              { label: 'Website', value: site ? `/${site.slug}` : 'Not assigned yet' },
            ],
            secretLabel: 'Temporary password',
            secret: result.temporaryPassword,
            expiresAt: result.temporaryPasswordExpiresAt,
          });
        }}
      />
      <EditCustomerDialog user={editing} onOpenChange={(o) => !o && setEditing(null)} />
      {actions.dialogs}
    </>
  );
}
