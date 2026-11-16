import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, ExternalLink, Globe, KeyRound, LogOut, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoList } from '@/components/shared/InfoList';
import { StatCard } from '@/components/shared/StatCard';
import { AccountStatusBadge, ActiveBadge, LockedBadge } from '@/components/shared/StatusBadges';
import { Badge } from '@/components/ui/badge';
import { EditCustomerDialog } from '@/features/admin/EditCustomerDialog';
import { CreateWebsiteDialog } from '@/features/admin/CreateWebsiteDialog';
import { useCustomerActions } from '@/features/admin/useCustomerActions';
import { sumSummaries, useWebsiteStats } from '@/features/admin/useDirectories';
import { adminService } from '@/services/admin.service';
import { queryKeys } from '@/lib/query';
import { formatCalendarDate, formatDateTime, formatNumber } from '@/utils/format';
import type { UserDetail } from '@/types/api';

export function CustomerDetailPage() {
  const { userId = '' } = useParams();
  const [editing, setEditing] = useState<UserDetail | null>(null);
  const [createSite, setCreateSite] = useState(false);
  const actions = useCustomerActions();
  const stats = useWebsiteStats();
  const query = useQuery({ queryKey: queryKeys.admin.user(userId), queryFn: () => adminService.user(userId) });

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const user = query.data;
  const totals = sumSummaries(user.websiteIds, stats.byWebsite);
  const tz = user.settings.timezone || undefined;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/admin/customers">
          <ArrowLeft /> Customers
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            @{user.username}
            <AccountStatusBadge status={user.accountStatus} />
            {user.isLocked && <LockedBadge />}
            {user.mustChangePassword && <Badge variant="warning">Must change password</Badge>}
          </span>
        }
        description={user.settings.displayName || 'Customer account'}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(user)}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" onClick={() => actions.resetPassword(user)}>
              <KeyRound /> Reset password
            </Button>
            <Button variant="outline" onClick={() => actions.revokeSessions(user)}>
              <LogOut /> Revoke sessions
            </Button>
            {user.accountStatus === 'disabled' ? (
              <Button onClick={() => actions.activate(user)}>
                <CheckCircle2 /> Activate
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => actions.disable(user)}>
                <Ban /> Disable
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Websites" value={formatNumber(user.websites.length)} icon={Globe} />
          <StatCard label="RSVP forms" value={totals.known ? formatNumber(totals.submissions) : '—'} loading={stats.isLoading} />
          <StatCard label="Attending guests" value={totals.known ? formatNumber(totals.attendingGuests) : '—'} loading={stats.isLoading} />
          <StatCard label="Wishes" value={totals.known ? formatNumber(totals.wishes) : '—'} loading={stats.isLoading} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              columns={2}
              items={[
                { label: 'Username', value: `@${user.username}` },
                { label: 'Display name', value: user.settings.displayName || '—' },
                { label: 'Registered', value: formatDateTime(user.createdAt, tz) },
                { label: 'Last sign-in', value: formatDateTime(user.lastLoginAt, tz) },
                { label: 'Password changed', value: formatDateTime(user.passwordChangedAt, tz) },
                {
                  label: 'Temporary password expires',
                  value: user.temporaryPasswordExpiresAt ? formatDateTime(user.temporaryPasswordExpiresAt, tz) : '—',
                },
                { label: 'Locked until', value: user.lockedUntil ? formatDateTime(user.lockedUntil, tz) : '—' },
                { label: 'Timezone', value: user.settings.timezone || '—' },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Assigned websites</CardTitle>
            <CardDescription>Websites this customer can manage.</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" onClick={() => setCreateSite(true)}>
                <Plus /> New website
              </Button>
            </CardAction>
          </CardHeader>
          {user.websites.length === 0 ? (
            <EmptyState icon={Globe} title="No websites assigned" description="Create a website or assign an existing one via Edit." className="border-t" compact />
          ) : (
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Website</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Wedding date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">RSVPs</TableHead>
                    <TableHead className="text-right">Guests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.websites.map((w) => {
                    const s = stats.byWebsite.get(w.id);
                    return (
                      <TableRow key={w.id}>
                        <TableCell>
                          <Link to={`/admin/websites/${w.id}`} className="font-medium hover:underline">
                            {w.websiteName}
                          </Link>
                          <p className="text-xs text-muted-foreground">/{w.slug}</p>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <a href={w.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 truncate text-muted-foreground hover:text-foreground">
                            {w.websiteUrl.replace(/^https?:\/\//, '')} <ExternalLink className="size-3 shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatCalendarDate(w.weddingDate)}</TableCell>
                        <TableCell>
                          <ActiveBadge active={w.isActive} />
                        </TableCell>
                        <TableCell className="text-right tabular">{formatNumber(s?.totalSubmissions)}</TableCell>
                        <TableCell className="text-right tabular">{formatNumber(s?.attendingGuests)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <EditCustomerDialog user={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <CreateWebsiteDialog open={createSite} onOpenChange={setCreateSite} defaultOwnerId={user.id} />
      {actions.dialogs}
    </>
  );
}
