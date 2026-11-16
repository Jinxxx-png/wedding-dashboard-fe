import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';

export function ChangePasswordPage() {
  return (
    <>
      <PageHeader title="Change password" description="Update the password you use to sign in." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New password</CardTitle>
          <CardDescription>Changing your password signs you out on all other devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </>
  );
}
