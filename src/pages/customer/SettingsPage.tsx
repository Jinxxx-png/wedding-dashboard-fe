import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { InfoList } from '@/components/shared/InfoList';
import { AccountStatusBadge, ActiveBadge } from '@/components/shared/StatusBadges';
import { ErrorState } from '@/components/shared/ErrorState';
import { useAuth } from '@/contexts/AuthContext';
import { useWebsites } from '@/contexts/WebsiteContext';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { AccountPreferencesForm } from '@/features/account/AccountPreferencesForm';
import { LogoutAllCard } from '@/features/account/LogoutAllCard';
import { WebsiteSettingsForm } from '@/features/websites/WebsiteSettingsForm';
import { customerService } from '@/services/customer.service';
import { queryKeys } from '@/lib/query';
import { formatCalendarDate, formatDateTime } from '@/utils/format';
import { SITE_PARAM } from '@/contexts/WebsiteContext';

export function SettingsPage() {
  const { user } = useAuth();
  // `website` is null when no website is assigned yet; the Website tab is hidden then.
  const { websites, website } = useWebsites();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: queryKeys.customer.settings, queryFn: customerService.settings });
  const account = settings.data ?? user;

  return (
    <>
      <PageHeader title="Settings" description="Your account, wedding website and security settings." />
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          {website && <TabsTrigger value="website">Website</TabsTrigger>}
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Account information</CardTitle>
              <CardDescription>Your username and role are managed by the administrator.</CardDescription>
            </CardHeader>
            <CardContent>
              {settings.isLoading || !account ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <InfoList
                  columns={2}
                  items={[
                    {
                      label: 'Username',
                      value: (
                        <span className="flex items-center gap-1.5 font-medium">
                          @{account.username} <Lock className="size-3 text-muted-foreground" aria-label="Not editable" />
                        </span>
                      ),
                    },
                    { label: 'Account status', value: <AccountStatusBadge status={account.accountStatus} /> },
                    { label: 'Member since', value: formatDateTime(account.createdAt, account.settings.timezone) },
                    { label: 'Last sign-in', value: formatDateTime(account.lastLoginAt, account.settings.timezone) },
                    { label: 'Password last changed', value: formatDateTime(account.passwordChangedAt, account.settings.timezone) },
                    { label: 'Assigned websites', value: `${websites.length}` },
                  ]}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Personalise how the dashboard displays and exports your data.</CardDescription>
            </CardHeader>
            <CardContent>
              {settings.error ? (
                <ErrorState error={settings.error} onRetry={() => settings.refetch()} compact />
              ) : account ? (
                <AccountPreferencesForm key={account.updatedAt} user={account} />
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {website && (
          <TabsContent value="website" className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{website.websiteName}</CardTitle>
                <CardDescription>Website details are managed by the administrator and are read-only here.</CardDescription>
              </CardHeader>
              <CardContent>
                <InfoList
                  columns={2}
                  items={[
                    { label: 'Website name', value: website.websiteName },
                    {
                      label: 'Website URL',
                      value: (
                        <a href={website.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                          {website.websiteUrl} <ExternalLink className="size-3" />
                        </a>
                      ),
                    },
                    { label: 'Website slug', value: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{website.slug}</code> },
                    { label: 'Wedding date', value: formatCalendarDate(website.weddingDate, true) },
                    { label: 'Timezone', value: website.timezone },
                    { label: 'Status', value: <ActiveBadge active={website.isActive} /> },
                  ]}
                />
              </CardContent>
            </Card>

            {websites.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Assigned websites</CardTitle>
                  <CardDescription>All wedding websites linked to your account.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y rounded-lg border">
                    {websites.map((w) => (
                      <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{w.websiteName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            /{w.slug} · {formatCalendarDate(w.weddingDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {w.id === website.id ? (
                            <Badge variant="secondary">Selected</Badge>
                          ) : (
                            <Link to={`/dashboard/settings?${SITE_PARAM}=${encodeURIComponent(w.id)}`} className="text-xs font-medium underline-offset-4 hover:underline">
                              Switch
                            </Link>
                          )}
                          <ActiveBadge active={w.isActive} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>RSVP & wishes settings</CardTitle>
                <CardDescription>Control how guests interact with {website.websiteName}.</CardDescription>
              </CardHeader>
              <CardContent>
                <WebsiteSettingsForm
                  key={website.id + website.updatedAt}
                  website={website}
                  onSave={async (body) => {
                    const updated = await customerService.updateWebsiteSettings(website.id, body);
                    queryClient.setQueryData(queryKeys.customer.websites, (prev: typeof websites | undefined) =>
                      prev?.map((w) => (w.id === updated.id ? updated : w)),
                    );
                    await queryClient.invalidateQueries({ queryKey: queryKeys.website.all(website.id) });
                    return updated;
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="security" className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>Changing your password signs you out on all other devices.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
          <LogoutAllCard />
        </TabsContent>
      </Tabs>
    </>
  );
}
