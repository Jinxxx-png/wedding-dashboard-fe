import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/components/forms/FormField';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { homePathFor, useAuth } from '@/contexts/AuthContext';
import { getLoginErrorMessage } from '@/utils/errors';
import type { UserView } from '@/types/api';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

/** Only honour a "return to" path that belongs to the signed-in user's area. */
function safeRedirect(from: unknown, user: UserView): string | null {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return null;
  if (user.role === 'admin' && from.startsWith('/admin')) return from;
  if (user.role === 'customer' && from.startsWith('/dashboard')) return from;
  return null;
}

export function LoginPage() {
  const { login, expiredReason, clearExpiredReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setFormError(null);
    clearExpiredReason();
    try {
      const session = await login(username, password);
      if (session.mustChangePassword) {
        navigate('/setup-password', { replace: true });
        return;
      }
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(safeRedirect(from, session.user) ?? homePathFor(session.user), { replace: true });
    } catch (error) {
      setFormError(getLoginErrorMessage(error));
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage your wedding RSVPs, guests and wishes.</p>
      </div>

      <Card className="py-6">
        <CardContent className="px-6">
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            {expiredReason && !formError && (
              <Alert variant="info">
                <Clock />
                <AlertDescription>{expiredReason}</AlertDescription>
              </Alert>
            )}
            {formError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FormField label="Username" error={errors.username?.message}>
              <Input
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                {...register('username')}
              />
            </FormField>
            <FormField label="Password" error={errors.password?.message}>
              <PasswordInput autoComplete="current-password" {...register('password')} />
            </FormField>
            <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Forgot your password? Contact your administrator to have it reset.
      </p>
    </div>
  );
}
