import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Eye, RotateCcw, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { InfoList } from '@/components/shared/InfoList';
import { DateRangeFilter, type DateRange } from '@/components/forms/DateRangeFilter';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { ListSkeleton, TableSkeletonRows } from '@/components/tables/TableSkeleton';
import { useCustomerDirectory } from '@/features/admin/useDirectories';
import { adminService } from '@/services/admin.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDefaultPageSize } from '@/hooks/useDefaultPageSize';
import { queryKeys } from '@/lib/query';
import { formatDateTime, humanize } from '@/utils/format';
import type { AuditLog, AuditTargetType } from '@/types/api';
import { AUDIT_ACTIONS, safeMetadata } from '@/features/admin/audit';

const ALL = '__all__';

const ACTION_GROUPS: { label: string; prefix: string }[] = [
  { label: 'Authentication', prefix: 'auth.' },
  { label: 'Administration', prefix: 'admin.' },
  { label: 'Data', prefix: '' },
];

const TARGET_TYPES: AuditTargetType[] = ['user', 'website', 'rsvp', 'wish', 'session', 'export'];
function actionTone(action: string): 'destructive' | 'warning' | 'secondary' | 'outline' {
  if (/failed|locked|disable|delete/.test(action)) return 'destructive';
  if (/reset_password|rotate_secret|slug_change|revoke/.test(action)) return 'warning';
  if (action.startsWith('admin.')) return 'secondary';
  return 'outline';
}

export function AuditLogsPage() {
  const [action, setAction] = useState(ALL);
  const [targetType, setTargetType] = useState(ALL);
  const [actor, setActor] = useState(ALL);
  const [targetIdInput, setTargetIdInput] = useState('');
  const targetId = useDebouncedValue(targetIdInput.trim(), 400);
  const [range, setRange] = useState<DateRange>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(useDefaultPageSize());
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const customers = useCustomerDirectory();
  const admins = useQuery({
    queryKey: queryKeys.admin.users({ role: 'admin', pageSize: 100 }),
    queryFn: () => adminService.users({ role: 'admin', pageSize: 100 }),
    staleTime: 60_000,
  });

  const query = {
    page,
    pageSize,
    action: action === ALL ? undefined : action,
    targetType: targetType === ALL ? undefined : targetType,
    actorUserId: actor === ALL ? undefined : actor,
    targetId: targetId || undefined,
    from: range.from,
    to: range.to,
  };
  const list = useQuery({
    queryKey: queryKeys.admin.auditLogs(query),
    queryFn: () => adminService.auditLogs(query),
    placeholderData: keepPreviousData,
  });

  const filtersActive = action !== ALL || targetType !== ALL || actor !== ALL || Boolean(targetId || range.from || range.to);
  const set = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };
  const actionsByGroup = useMemo(
    () =>
      ACTION_GROUPS.map((g) => ({
        ...g,
        actions: Object.keys(AUDIT_ACTIONS).filter((a) =>
          g.prefix ? a.startsWith(g.prefix) : !a.startsWith('auth.') && !a.startsWith('admin.'),
        ),
      })),
    [],
  );
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader title="Audit Logs" description="A record of sign-ins, administrative changes and data exports." />
      <Card className="gap-0 overflow-hidden pb-0">
        <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2 sm:px-5 lg:flex lg:flex-wrap lg:items-center">
          <Select value={action} onValueChange={set(setAction)}>
            <SelectTrigger className="w-full lg:w-[220px]" aria-label="Action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {actionsByGroup.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIT_ACTIONS[a]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Select value={targetType} onValueChange={set(setTargetType)}>
            <SelectTrigger className="w-full lg:w-[150px]" aria-label="Target type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All targets</SelectItem>
              {TARGET_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {humanize(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actor} onValueChange={set(setActor)}>
            <SelectTrigger className="w-full lg:w-[180px]" aria-label="Actor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All users</SelectItem>
              {(admins.data?.items ?? []).length > 0 && (
                <SelectGroup>
                  <SelectLabel>Admins</SelectLabel>
                  {admins.data?.items.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      @{u.username}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {customers.customers.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Customers</SelectLabel>
                  {customers.customers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      @{u.username}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <Input
            value={targetIdInput}
            onChange={(e) => {
              setTargetIdInput(e.target.value);
              setPage(1);
            }}
            placeholder="Target ID"
            className="w-full font-mono text-xs lg:w-[180px]"
            aria-label="Target ID"
          />
          <DateRangeFilter value={range} onChange={set(setRange)} />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-start text-muted-foreground"
              onClick={() => {
                setAction(ALL);
                setTargetType(ALL);
                setActor(ALL);
                setTargetIdInput('');
                setRange({});
                setPage(1);
              }}
            >
              <RotateCcw /> Reset
            </Button>
          )}
        </div>

        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} compact className="border-t" />
        ) : !list.isLoading && items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            className="border-t"
            title={filtersActive ? 'No log entries match your filters' : 'No audit log entries yet'}
            description={filtersActive ? 'Try widening the date range or clearing filters.' : undefined}
          />
        ) : (
          <>
            <div className="hidden border-t md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date & time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">View</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                {list.isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : (
                  <TableBody>
                    {items.map((log) => {
                      const meta = safeMetadata(log.metadata);
                      return (
                        <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                          <TableCell className="text-muted-foreground tabular">{formatDateTime(log.createdAt)}</TableCell>
                          <TableCell>
                            <span className="font-medium">{log.actorUsername ? `@${log.actorUsername}` : 'System'}</span>
                            {log.actorRole && <span className="ml-1.5 text-xs text-muted-foreground">{log.actorRole}</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={actionTone(log.action)}>{AUDIT_ACTIONS[log.action] ?? log.action}</Badge>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{log.action}</p>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <span className="block">{humanize(log.targetType)}</span>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">{log.targetId || '—'}</span>
                          </TableCell>
                          <TableCell className="max-w-[320px] whitespace-normal">
                            {meta.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                                {meta.slice(0, 3).map(([k, v]) => (
                                  <div key={k} className="flex min-w-0 gap-1">
                                    <dt className="text-muted-foreground">{k}:</dt>
                                    <dd className="max-w-[160px] truncate">{v}</dd>
                                  </div>
                                ))}
                                {meta.length > 3 && <span className="text-muted-foreground">+{meta.length - 3} more</span>}
                              </dl>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon-sm" aria-label="View log entry">
                              <Eye />
                            </Button>
                          </TableCell>
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
                  {items.map((log) => (
                    <li key={log.id}>
                      <button type="button" onClick={() => setSelected(log)} className="w-full space-y-1 px-4 py-3 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={actionTone(log.action)}>{AUDIT_ACTIONS[log.action] ?? log.action}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                        </div>
                        <p className="text-sm">
                          {log.actorUsername ? `@${log.actorUsername}` : 'System'} · {humanize(log.targetType)}
                        </p>
                      </button>
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
            itemLabel="entries"
          />
        </div>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{AUDIT_ACTIONS[selected.action] ?? selected.action}</DialogTitle>
                <DialogDescription>{formatDateTime(selected.createdAt)}</DialogDescription>
              </DialogHeader>
              <InfoList
                columns={2}
                items={[
                  { label: 'User', value: selected.actorUsername ? `@${selected.actorUsername}` : 'System' },
                  { label: 'Role', value: selected.actorRole ? humanize(selected.actorRole) : '—' },
                  { label: 'Action', value: <code className="font-mono text-xs">{selected.action}</code> },
                  { label: 'Target', value: `${humanize(selected.targetType)} · ${selected.targetId || '—'}` },
                  { label: 'IP address', value: selected.ipAddress || '—' },
                  { label: 'Request ID', value: <code className="font-mono text-xs">{selected.requestId || '—'}</code> },
                ]}
              />
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Metadata</p>
                {safeMetadata(selected.metadata).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No additional metadata.</p>
                ) : (
                  <dl className="divide-y rounded-lg border text-sm">
                    {safeMetadata(selected.metadata).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[minmax(0,140px)_1fr] gap-3 px-3 py-2">
                        <dt className="truncate text-muted-foreground">{k}</dt>
                        <dd className="font-mono text-xs break-all">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
