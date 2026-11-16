import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { InfoList } from '@/components/shared/InfoList';
import { AccountStatusBadge } from '@/components/shared/StatusBadges';
import { ErrorState } from '@/components/shared/ErrorState';
import { useAuth } from '@/contexts/AuthContext';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { AccountPreferencesForm } from '@/features/account/AccountPreferencesForm';
import { LogoutAllCard } from '@/features/account/LogoutAllCard';
import { customerService } from '@/services/customer.service';
import { queryKeys } from '@/lib/query';
import { formatDateTime } from '@/utils/format';

/** Admin's own account: info, preferences (`/customer/settings` is open to admins), password, sessions. */
export function AdminSettingsPage() {
  const { user } = useAuth();
  const settings = useQuery({ queryKey: queryKeys.customer.settings, queryFn: customerService.settings });
  const account = settings.data ?? user;

  return (
    <>
      <PageHeader title="Settings" description="Your administrator account and security." />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            {!account ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <InfoList
                columns={2}
                items={[
                  { label: 'Username', value: `@${account.username}` },
                  { label: 'Role', value: 'Administrator' },
                  { label: 'Account status', value: <AccountStatusBadge status={account.accountStatus} /> },
                  { label: 'Last sign-in', value: formatDateTime(account.lastLoginAt) },
                ]}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Display name, timezone and export defaults.</CardDescription>
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
      </div>
    </>
  );
}
