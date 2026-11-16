import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, Globe, Heart, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { AccountStatusBadge, ActiveBadge } from '@/components/shared/StatusBadges';
import { ListSkeleton, TableSkeletonRows } from '@/components/tables/TableSkeleton';
import { DateRangeFilter, type DateRange } from '@/components/forms/DateRangeFilter';
import {
  AttendanceDistributionCard,
  GuestBreakdownCard,
  MealPreferenceCard,
  RsvpTrendCard,
} from '@/features/analytics/AnalyticsCharts';
import { useGlobalAnalytics } from '@/features/analytics/useAnalytics';
import { RecentRsvpList } from '@/features/rsvps/RecentRsvpList';
import { RecentWishList } from '@/features/wishes/RecentWishList';
import { useWebsiteDirectory } from '@/features/admin/useDirectories';
import { AUDIT_ACTIONS } from '@/features/admin/audit';
import { adminService } from '@/services/admin.service';
import { queryKeys } from '@/lib/query';
import { formatCalendarDate, formatNumber, formatPercent, formatRelative } from '@/utils/format';
import type { Granularity } from '@/types/api';

export function AdminOverviewPage() {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [range, setRange] = useState<DateRange>({});
  const directory = useWebsiteDirectory();

  const dashboard = useQuery({ queryKey: queryKeys.admin.dashboard, queryFn: adminService.dashboard });
  const analytics = useGlobalAnalytics(granularity, range);
  const activeCustomersQ = { role: 'customer' as const, accountStatus: 'active' as const, page: 1, pageSize: 1 };
  const activeCustomers = useQuery({
    queryKey: queryKeys.admin.users(activeCustomersQ),
    queryFn: () => adminService.users(activeCustomersQ),
  });
  const latestCustomersQ = { role: 'customer' as const, page: 1, pageSize: 5 };
  const latestCustomers = useQuery({
    queryKey: queryKeys.admin.users(latestCustomersQ),
    queryFn: () => adminService.users(latestCustomersQ),
  });
  const latestRsvpsQ = { page: 1, pageSize: 5, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };
  const latestRsvps = useQuery({ queryKey: queryKeys.admin.rsvps(latestRsvpsQ), queryFn: () => adminService.rsvps(latestRsvpsQ) });
  const latestWishesQ = { page: 1, pageSize: 4, sortOrder: 'desc' as const };
  const latestWishes = useQuery({ queryKey: queryKeys.admin.wishes(latestWishesQ), queryFn: () => adminService.wishes(latestWishesQ) });

  if (dashboard.error && !dashboard.data) return <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />;
  const d = dashboard.data;
  const t = d?.totals;
  const loading = dashboard.isLoading;
  const websiteLabel = (id: string) => {
    const w = directory.get(id);
    return w ? { name: w.websiteName, slug: w.slug, timezone: w.timezone } : undefined;
  };
  const newestCustomers = [...(latestCustomers.data?.items ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Customers, websites and RSVP activity across Wedding Project."
        actions={<DateRangeFilter value={range} onChange={setRange} timezoneNote="Analytics dates use each website’s timezone." />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total customers" value={formatNumber(d?.users.customers)} icon={Users} loading={loading} hint={d ? `${formatNumber(d.users.pendingPasswordSetup)} pending setup` : undefined} />
        <StatCard
          label="Active customers"
          value={formatNumber(activeCustomers.data?.meta.totalItems)}
          icon={UserCheck}
          loading={activeCustomers.isLoading}
          hint={d ? `${formatNumber(d.users.disabled)} disabled accounts` : undefined}
        />
        <StatCard label="Total websites" value={formatNumber(d?.websites.total)} icon={Globe} loading={loading} />
        <StatCard
          label="Active websites"
          value={formatNumber(d?.websites.active)}
          icon={CheckCircle2}
          loading={loading}
          hint={d && d.websites.total ? `${formatPercent((d.websites.active / d.websites.total) * 100)} of websites` : undefined}
        />
        <StatCard label="RSVP forms" value={formatNumber(t?.totalSubmissions)} icon={ClipboardList} loading={loading} hint="All websites" />
        <StatCard label="Guests attending" value={formatNumber(t?.attendingGuests)} icon={UserCheck} loading={loading} hint="People, not forms" />
        <StatCard label="Wedding wishes" value={formatNumber(t?.totalWishes)} icon={Heart} loading={loading} className="col-span-2 md:col-span-1" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <RsvpTrendCard
          className="xl:col-span-3"
          title="Platform RSVP trend"
          points={analytics.data?.trends}
          granularity={granularity}
          onGranularityChange={setGranularity}
          loading={analytics.isLoading}
          error={analytics.error}
          onRetry={() => analytics.refetch()}
          rangeActive={Boolean(range.from || range.to)}
        />
        <div className="xl:col-span-2">
          <AttendanceDistributionCard analytics={analytics.data} loading={analytics.isLoading} error={analytics.error} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <GuestBreakdownCard analytics={analytics.data} loading={analytics.isLoading} error={analytics.error} />
        <MealPreferenceCard analytics={analytics.data} loading={analytics.isLoading} error={analytics.error} />
      </div>

      <Card className="mt-4 gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Website activity</CardTitle>
          <CardDescription>Most active websites by RSVP submissions</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/websites">
                All websites <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <div className="border-t">
          {!loading && (d?.topWebsites.length ?? 0) === 0 ? (
            <EmptyState icon={Globe} title="No website activity yet" compact />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Website</TableHead>
                  <TableHead>Wedding date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">RSVP forms</TableHead>
                  <TableHead className="text-right">Attending guests</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Wishes</TableHead>
                </TableRow>
              </TableHeader>
              {loading ? (
                <TableSkeletonRows columns={7} rows={5} />
              ) : (
                <TableBody>
                  {d?.topWebsites.map((w) => (
                    <TableRow key={w.websiteId}>
                      <TableCell>
                        <Link to={`/admin/websites/${w.websiteId}`} className="font-medium hover:underline">
                          {w.websiteName}
                        </Link>
                        <p className="text-xs text-muted-foreground">/{w.slug}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatCalendarDate(w.weddingDate)}</TableCell>
                      <TableCell>
                        <ActiveBadge active={w.isActive} />
                      </TableCell>
                      <TableCell className="text-right tabular">{formatNumber(w.summary.totalSubmissions)}</TableCell>
                      <TableCell className="text-right tabular">{formatNumber(w.summary.attendingGuests)}</TableCell>
                      <TableCell className="text-right tabular">{formatPercent(w.summary.attendancePercentage)}</TableCell>
                      <TableCell className="text-right tabular">{formatNumber(w.summary.totalWishes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              )}
            </Table>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="gap-0 pb-0">
          <CardHeader className="pb-3">
            <CardTitle>Latest customers</CardTitle>
            <CardDescription>Recently registered accounts</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/customers">
                  View all <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <div className="border-t">
            {latestCustomers.isLoading ? (
              <ListSkeleton rows={5} />
            ) : latestCustomers.error ? (
              <ErrorState error={latestCustomers.error} onRetry={() => latestCustomers.refetch()} compact />
            ) : newestCustomers.length === 0 ? (
              <EmptyState icon={Users} title="No customers yet" compact />
            ) : (
              <ul className="divide-y">
                {newestCustomers.map((u) => (
                  <li key={u.id}>
                    <Link to={`/admin/customers/${u.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">@{u.username}</p>
                        <p className="text-xs text-muted-foreground">Registered {formatRelative(u.createdAt)}</p>
                      </div>
                      <AccountStatusBadge status={u.accountStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <RecentRsvpList
          title="Latest RSVP submissions"
          items={latestRsvps.data?.items}
          loading={latestRsvps.isLoading}
          error={latestRsvps.error}
          onRetry={() => latestRsvps.refetch()}
          websiteLabel={websiteLabel}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/rsvps">
                View all <ArrowRight />
              </Link>
            </Button>
          }
        />
        <RecentWishList
          title="Latest wishes"
          items={latestWishes.data?.items}
          loading={latestWishes.isLoading}
          error={latestWishes.error}
          onRetry={() => latestWishes.refetch()}
          websiteLabel={(id) => directory.get(id)?.websiteName}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/wishes">
                View all <ArrowRight />
              </Link>
            </Button>
          }
        />
      </div>

      <Card className="mt-4 gap-0 pb-0">
        <CardHeader className="pb-3">
          <CardTitle>Recent administrative activity</CardTitle>
          <CardDescription>Latest audit log entries</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/audit-logs">
                Audit logs <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <div className="border-t">
          {loading ? (
            <ListSkeleton rows={4} />
          ) : !d?.recentAuditLogs.length ? (
            <EmptyState title="No activity yet" compact />
          ) : (
            <ul className="divide-y">
              {d.recentAuditLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                  <Badge variant="outline">{AUDIT_ACTIONS[log.action] ?? log.action}</Badge>
                  <span className="text-muted-foreground">
                    {log.actorUsername ? `@${log.actorUsername}` : 'System'} · {log.targetType}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatRelative(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}
