import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, ExternalLink, KeyRound, MoreHorizontal, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { InfoList } from '@/components/shared/InfoList';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { OneTimeSecretDialog, type OneTimeSecret } from '@/components/shared/OneTimeSecretDialog';
import { AccountStatusBadge, ActiveBadge } from '@/components/shared/StatusBadges';
import { DateRangeFilter, type DateRange } from '@/components/forms/DateRangeFilter';
import { WebsiteAnalyticsSection } from '@/features/analytics/WebsiteAnalyticsSection';
import { RsvpManager } from '@/features/rsvps/RsvpManager';
import { GuestManager } from '@/features/guests/GuestManager';
import { WishesManager } from '@/features/wishes/WishesManager';
import { WebsiteSettingsForm } from '@/features/websites/WebsiteSettingsForm';
import { WebsiteAdminForm } from '@/features/admin/WebsiteAdminForm';
import { useCustomerDirectory } from '@/features/admin/useDirectories';
import { adminService } from '@/services/admin.service';
import { queryKeys } from '@/lib/query';
import { notifyError } from '@/utils/errors';
import { formatCalendarDate, formatDateTime, formatNumber, humanize } from '@/utils/format';

type Confirm = 'toggle' | 'rotate' | 'recompute' | null;

export function WebsiteDetailPage() {
  const { websiteId = '' } = useParams();
  const queryClient = useQueryClient();
  const customers = useCustomerDirectory();
  const [range, setRange] = useState<DateRange>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [secret, setSecret] = useState<OneTimeSecret | null>(null);

  const query = useQuery({ queryKey: queryKeys.admin.website(websiteId), queryFn: () => adminService.website(websiteId) });

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const website = query.data;
  const owner = website.ownerUserId ? customers.byId.get(website.ownerUserId) : undefined;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.website.all(website.id) });
  };

  const runConfirm = async () => {
    try {
      if (confirm === 'toggle') {
        const updated = await adminService.updateWebsite(website.id, { isActive: !website.isActive });
        queryClient.setQueryData(queryKeys.admin.website(website.id), updated);
        await refresh();
        toast.success(updated.isActive ? 'Website activated' : 'Website deactivated');
      } else if (confirm === 'rotate') {
        const result = await adminService.rotateSigningSecret(website.id);
        await refresh();
        setSecret({
          title: 'New signing secret',
          description: 'Use this secret for server-to-server signed requests. The previous secret no longer works.',
          details: [
            { label: 'Website', value: `/${website.slug}` },
            { label: 'Key ID', value: result.keyId },
          ],
          secretLabel: 'Signing secret',
          secret: result.secret,
          note: 'Store it in the wedding website’s server configuration now. It cannot be displayed again.',
        });
      } else if (confirm === 'recompute') {
        const summary = await adminService.recomputeStats(website.id);
        await refresh();
        toast.success('Statistics recomputed', {
          description: `${formatNumber(summary.totalSubmissions)} RSVP forms · ${formatNumber(summary.attendingGuests)} attending guests`,
        });
      }
    } catch (error) {
      notifyError(error, 'Action failed');
      throw error;
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/admin/websites">
          <ArrowLeft /> Websites
        </Link>
      </Button>
      <PageHeader
        eyebrow={<code className="font-mono">/{website.slug}</code>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {website.websiteName} <ActiveBadge active={website.isActive} />
          </span>
        }
        description={
          <a href={website.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-foreground">
            {website.websiteUrl.replace(/^https?:\/\//, '')} <ExternalLink className="size-3" />
          </a>
        }
        actions={
          <>
            <Button variant={website.isActive ? 'outline' : 'default'} onClick={() => setConfirm('toggle')}>
              {website.isActive ? <PowerOff /> : <Power />}
              {website.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More website actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setConfirm('recompute')}>
                  <Calculator /> Recompute statistics
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setConfirm('rotate')}>
                  <KeyRound /> Rotate signing secret
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rsvps">RSVPs</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
          <TabsTrigger value="wishes">Wishes</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Website information</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoList
                  columns={2}
                  items={[
                    { label: 'Wedding date', value: formatCalendarDate(website.weddingDate, true) },
                    { label: 'Timezone', value: website.timezone },
                    { label: 'Status', value: <ActiveBadge active={website.isActive} /> },
                    { label: 'Integration', value: `${humanize(website.integration.mode)} mode${website.integration.captchaRequired ? ' · CAPTCHA' : ''}` },
                    {
                      label: 'Allowed origins',
                      value: website.integration.allowedOrigins.length ? website.integration.allowedOrigins.join(', ') : 'Any origin',
                    },
                    {
                      label: 'Signing secret',
                      value: website.integration.hasSigningSecret
                        ? `Key ${website.integration.signingKeyId ?? ''} · rotated ${formatDateTime(website.integration.secretRotatedAt)}`
                        : 'Not configured',
                    },
                    { label: 'RSVPs', value: website.rsvpSettings.acceptingRsvps ? 'Accepting' : 'Closed' },
                    { label: 'Wishes', value: website.wishSettings.acceptingWishes ? `Accepting · ${website.wishSettings.autoApprove ? 'auto-approve' : 'manual approval'}` : 'Closed' },
                    { label: 'Created', value: formatDateTime(website.createdAt) },
                    { label: 'Last updated', value: formatDateTime(website.updatedAt) },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Owner</CardTitle>
                <CardDescription>Customer who manages this website</CardDescription>
              </CardHeader>
              <CardContent>
                {website.ownerUserId ? (
                  <div className="space-y-3">
                    <div>
                      <Link to={`/admin/customers/${website.ownerUserId}`} className="font-medium hover:underline">
                        @{owner?.username ?? 'customer'}
                      </Link>
                      {owner?.settings.displayName && <p className="text-sm text-muted-foreground">{owner.settings.displayName}</p>}
                    </div>
                    {owner && <AccountStatusBadge status={owner.accountStatus} />}
                    {owner && (
                      <p className="text-xs text-muted-foreground">
                        Last sign-in {formatDateTime(owner.lastLoginAt)} · {owner.websiteIds.length} website
                        {owner.websiteIds.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">This website is not assigned to a customer. Assign an owner in Settings.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">RSVP analytics</h2>
            <DateRangeFilter value={range} onChange={setRange} timezoneNote={`Dates are interpreted in ${website.timezone}.`} />
          </div>
          <WebsiteAnalyticsSection website={website} range={range} />
        </TabsContent>

        <TabsContent value="rsvps">
          <RsvpManager website={website} />
        </TabsContent>
        <TabsContent value="guests">
          <GuestManager website={website} />
        </TabsContent>
        <TabsContent value="wishes">
          <WishesManager website={website} />
        </TabsContent>

        <TabsContent value="settings" className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Website details & integration</CardTitle>
              <CardDescription>Admin-only fields. Customers see these as read-only.</CardDescription>
            </CardHeader>
            <CardContent>
              <WebsiteAdminForm key={website.updatedAt} website={website} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>RSVP & wishes settings</CardTitle>
              <CardDescription>The same settings the customer can manage.</CardDescription>
            </CardHeader>
            <CardContent>
              <WebsiteSettingsForm
                key={`settings-${website.updatedAt}`}
                website={website}
                onSave={async (body) => {
                  const updated = await adminService.updateWebsite(website.id, body);
                  queryClient.setQueryData(queryKeys.admin.website(website.id), updated);
                  await refresh();
                  return updated;
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === 'toggle'
            ? website.isActive
              ? 'Deactivate this website?'
              : 'Activate this website?'
            : confirm === 'rotate'
              ? 'Rotate the signing secret?'
              : 'Recompute statistics?'
        }
        description={
          confirm === 'toggle'
            ? website.isActive
              ? 'RSVP and wish forms on the public wedding website will stop working (WEBSITE_INACTIVE). Existing data is kept.'
              : 'The public wedding website will accept RSVPs and wishes again.'
            : confirm === 'rotate'
              ? 'A new secret will be generated and shown once. The current secret stops working immediately — only needed for signed server-to-server integrations.'
              : 'Rebuilds the aggregate RSVP and wish counters for this website from the stored records.'
        }
        confirmLabel={confirm === 'toggle' ? (website.isActive ? 'Deactivate' : 'Activate') : confirm === 'rotate' ? 'Rotate secret' : 'Recompute'}
        destructive={confirm === 'rotate' || (confirm === 'toggle' && website.isActive)}
        onConfirm={runConfirm}
      />
      <OneTimeSecretDialog secret={secret} onClose={() => setSecret(null)} />
    </>
  );
}
