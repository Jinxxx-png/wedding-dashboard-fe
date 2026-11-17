import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/components/forms/FormField';
import { PasswordChecklist, PasswordInput } from '@/components/forms/PasswordInput';
import { homePathFor, useAuth } from '@/contexts/AuthContext';
import { setupPasswordSchema } from '@/utils/password';
import { applyServerErrors } from '@/utils/errors';
import { formatDateTime } from '@/utils/format';

const schema = setupPasswordSchema();

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

const FIELDS = ['newPassword', 'confirmPassword'] as const;

/** Mandatory first-time password setup for restricted (temporary-password) sessions. */
export function SetupPasswordPage() {
  const { user, setupPassword, logout } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const newPassword = watch('newPassword');

  const onSubmit = handleSubmit(async ({ newPassword: pwd, confirmPassword }) => {
    setFormError(null);
    try {
      const session = await setupPassword(pwd, confirmPassword);
      toast.success('Password set', { description: 'Your account is ready to use.' });
      navigate(homePathFor(session.user, session.mustChangePassword), { replace: true });
    } catch (error) {
      const rest = applyServerErrors(error, setError, { fields: FIELDS });
      if (rest.length) setFormError(rest.join('\n'));
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl border bg-card shadow-xs">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Set your password</h1>
        <p className="text-sm text-muted-foreground">
          You signed in with a temporary password. Choose a new password to continue
          {user ? (
            <>
              {' '}as <span className="font-medium text-foreground">@{user.username}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      <Card className="py-6">
        <CardContent className="px-6">
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            {formError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription className="whitespace-pre-line">{formError}</AlertDescription>
              </Alert>
            )}
            <FormField label="New password" error={errors.newPassword?.message}>
              <PasswordInput autoComplete="new-password" autoFocus {...register('newPassword')} />
            </FormField>
            <PasswordChecklist password={newPassword} />
            <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
              <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
            </FormField>
            <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? 'Saving…' : 'Set password and continue'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        {user?.temporaryPasswordExpiresAt && (
          <p>Temporary password expires {formatDateTime(user.temporaryPasswordExpiresAt)}.</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut /> Log out
        </Button>
      </div>
    </div>
  );
}
