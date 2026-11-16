import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/components/forms/FormField';
import { PasswordChecklist, PasswordInput } from '@/components/forms/PasswordInput';
import { useAuth } from '@/contexts/AuthContext';
import { changePasswordSchema } from '@/utils/password';
import { applyServerErrors } from '@/utils/errors';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;

export function ChangePasswordForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user, changePassword } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(() => changePasswordSchema(user?.username), [user?.username]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword, values.confirmPassword);
      reset();
      toast.success('Password changed', { description: 'Other devices have been signed out.' });
      onSuccess?.();
    } catch (error) {
      const rest = applyServerErrors(error, setError, { fields: FIELDS });
      if (rest.length) setFormError(rest.join('\n'));
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="whitespace-pre-line">{formError}</AlertDescription>
        </Alert>
      )}
      <FormField label="Current password" error={errors.currentPassword?.message}>
        <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
      </FormField>
      <FormField label="New password" error={errors.newPassword?.message}>
        <PasswordInput autoComplete="new-password" {...register('newPassword')} />
      </FormField>
      <PasswordChecklist password={watch('newPassword')} username={user?.username} />
      <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
      </FormField>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </form>
  );
}
