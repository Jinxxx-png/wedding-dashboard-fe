import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  Eye,
  KeyRound,
  LogOut,
  MoreHorizontal,
  Pencil,
  Settings,
  ShieldCheck,
  User,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/forms/SearchInput';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { AccountStatusBadge, LockedBadge, RoleBadge } from '@/components/shared/StatusBadges';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { ListSkeleton, TableSkeletonRows } from '@/components/tables/TableSkeleton';
import { EditCustomerDialog } from '@/features/admin/EditCustomerDialog';
import { useCustomerActions } from '@/features/admin/useCustomerActions';
import { useRoleChange } from '@/features/admin/useRoleChange';
import { useAuth } from '@/contexts/AuthContext';
import { adminService } from '@/services/admin.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDefaultPageSize } from '@/hooks/useDefaultPageSize';
import { queryKeys } from '@/lib/query';
import { formatDate, formatNumber, formatRelative } from '@/utils/format';
import { notifyError } from '@/utils/errors';
import type { AccountStatus, Role, UserDetail, UserView } from '@/types/api';

type RoleFilter = 'all' | Role;
type StatusFilter = 'all' | AccountStatus;

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admins' },
  { value: 'customer', label: 'Customers' },
];

/** Every account (admins and customers): filter by role/status, change roles and manage access. */
export function AccountsPage() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(useDefaultPageSize());
  const [editing, setEditing] = useState<UserDetail | null>(null);
  const actions = useCustomerActions();
  const roles = useRoleChange();

  const query = {
    page,
    pageSize,
    role: role === 'all' ? undefined : role,
    accountStatus: status === 'all' ? undefined : status,
    search: search || undefined,
  };
  const list = useQuery({
    queryKey: queryKeys.admin.users(query),
    queryFn: () => adminService.users(query),
    placeholderData: keepPreviousData,
  });

  const openEdit = async (u: UserView) => {
    try {
      setEditing(await adminService.user(u.id));
    } catch (error) {
      notifyError(error, 'Could not load the account');
    }
  };

  const rowActions = (u: UserView) => {
    const isSelf = u.id === me?.id;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.username}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {u.role === 'customer' && (
            <DropdownMenuItem onSelect={() => navigate(`/admin/customers/${u.id}`)}>
              <Eye /> View customer
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void openEdit(u)}>
            <Pencil /> Edit details
          </DropdownMenuItem>
          {isSelf ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                You can’t change your own role or disable yourself.
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => navigate('/admin/settings')}>
                <Settings /> Your account settings
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              {u.role === 'customer' ? (
                <DropdownMenuItem onSelect={() => roles.changeRole(u, 'admin')}>
                  <ShieldCheck /> Make admin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => roles.changeRole(u, 'customer')}>
                  <User /> Make customer
                </DropdownMenuItem>
              )}
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const nameCell = (u: UserView) => (
    <>
      <span className="flex items-center gap-1.5">
        {u.role === 'customer' ? (
          <Link to={`/admin/customers/${u.id}`} className="font-medium hover:underline">
            @{u.username}
          </Link>
        ) : (
          <span className="font-medium">@{u.username}</span>
        )}
        {u.id === me?.id && <Badge variant="secondary">You</Badge>}
      </span>
      {u.settings.displayName && <p className="text-xs text-muted-foreground">{u.settings.displayName}</p>}
    </>
  );

  const statusCell = (u: UserView) => (
    <div className="flex flex-wrap gap-1">
      <AccountStatusBadge status={u.accountStatus} />
      {u.isLocked && <LockedBadge />}
    </div>
  );

  const websitesLabel = (u: UserView) =>
    u.role === 'admin' ? '—' : u.websiteIds.length === 0 ? 'None' : formatNumber(u.websiteIds.length);

  const items = list.data?.items ?? [];
  const filtersActive = Boolean(search || role !== 'all' || status !== 'all');

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every admin and customer account. Change roles, reset passwords and control access. New accounts are created on the Customers page; promote one here to make it an admin."
      />

      <Card className="gap-0 overflow-hidden pb-0">
        <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <SearchInput
            value={searchInput}
            onChange={(v) => {
              setSearchInput(v);
              setPage(1);
            }}
            placeholder="Search by username…"
            className="sm:max-w-xs"
          />
          <SegmentedControl
            aria-label="Role"
            size="default"
            value={role}
            options={ROLE_OPTIONS}
            onChange={(v) => {
              setRole(v);
              setPage(1);
            }}
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
            icon={UserCog}
            className="border-t"
            title={filtersActive ? 'No accounts match your filters' : 'No accounts yet'}
            description={filtersActive ? 'Try a different username, role or status.' : 'Create a customer to get started.'}
          />
        ) : (
          <>
            <div className="hidden border-t md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Account</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Websites</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                {list.isLoading ? (
                  <TableSkeletonRows columns={7} />
                ) : (
                  <TableBody>
                    {items.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{nameCell(u)}</TableCell>
                        <TableCell>
                          <RoleBadge role={u.role} />
                        </TableCell>
                        <TableCell>{statusCell(u)}</TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">{websitesLabel(u)}</TableCell>
                        <TableCell className="text-muted-foreground">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Never'}</TableCell>
                        <TableCell className="text-muted-foreground tabular">{formatDate(u.createdAt)}</TableCell>
                        <TableCell>{rowActions(u)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                )}
              </Table>
            </div>
            <div className="border-t md:hidden">
              {list.isLoading ? (
                <ListSkeleton />
              ) : (
                <ul className="divide-y">
                  {items.map((u) => (
                    <li key={u.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="truncate">{nameCell(u)}</div>
                        <div className="flex flex-wrap gap-1">
                          <RoleBadge role={u.role} />
                          <AccountStatusBadge status={u.accountStatus} />
                          {u.isLocked && <LockedBadge />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {u.role === 'customer' &&
                            `${u.websiteIds.length === 0 ? 'No' : formatNumber(u.websiteIds.length)} website${u.websiteIds.length === 1 ? '' : 's'} · `}
                          Last sign-in {u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'never'}
                        </p>
                      </div>
                      {rowActions(u)}
                    </li>
                  ))}
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
            itemLabel="accounts"
          />
        </div>
      </Card>

      <EditCustomerDialog user={editing} onOpenChange={(o) => !o && setEditing(null)} />
      {actions.dialogs}
      {roles.dialog}
    </>
  );
}
