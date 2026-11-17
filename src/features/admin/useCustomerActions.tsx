import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { OneTimeSecretDialog, type OneTimeSecret } from '@/components/shared/OneTimeSecretDialog';
import { adminService } from '@/services/admin.service';
import { queryKeys } from '@/lib/query';
import { notifyError } from '@/utils/errors';
import type { UserView } from '@/types/api';

type PendingAction = { kind: 'reset' | 'disable' | 'activate' | 'revoke'; user: UserView } | null;

/**
 * Account actions for admins: reset password (one-time secret), disable, activate,
 * revoke sessions. Every action is confirmed first; the backend refuses actions on yourself.
 */
export function useCustomerActions() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingAction>(null);
  // One-time secret lives only in component state and is discarded when the dialog closes.
  const [secret, setSecret] = useState<OneTimeSecret | null>(null);

  const refresh = (userId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.user(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.customerDirectory }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard }),
    ]);

  const run = async () => {
    if (!pending) return;
    const { kind, user } = pending;
    try {
      if (kind === 'reset') {
        const result = await adminService.resetPassword(user.id);
        await refresh(user.id);
        setSecret({
          title: 'Temporary password generated',
          description: `${user.username} must set a new password the next time they sign in. They have been signed out everywhere.`,
          details: [{ label: 'Username', value: result.user.username }],
          secretLabel: 'Temporary password',
          secret: result.temporaryPassword,
          expiresAt: result.temporaryPasswordExpiresAt,
        });
      } else if (kind === 'disable') {
        await adminService.disableUser(user.id);
        await refresh(user.id);
        toast.success(`${user.username} has been disabled`, { description: 'They were signed out immediately.' });
      } else if (kind === 'activate') {
        await adminService.activateUser(user.id);
        await refresh(user.id);
        toast.success(`${user.username} has been activated`);
      } else {
        const r = await adminService.revokeSessions(user.id);
        await refresh(user.id);
        toast.success('Sessions revoked', {
          description: `${r.sessionsRevoked} active session${r.sessionsRevoked === 1 ? '' : 's'} ended for ${user.username}.`,
        });
      }
    } catch (error) {
      notifyError(error, 'Action failed');
      throw error;
    }
  };

  const copy = pending ? CONFIRM_COPY[pending.kind](pending.user) : null;

  const dialogs = (
    <>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={copy?.title ?? ''}
        description={copy?.description}
        confirmLabel={copy?.confirm}
        destructive={pending?.kind === 'disable' || pending?.kind === 'revoke'}
        onConfirm={run}
      />
      <OneTimeSecretDialog secret={secret} onClose={() => setSecret(null)} />
    </>
  );

  return {
    resetPassword: (user: UserView) => setPending({ kind: 'reset', user }),
    disable: (user: UserView) => setPending({ kind: 'disable', user }),
    activate: (user: UserView) => setPending({ kind: 'activate', user }),
    revokeSessions: (user: UserView) => setPending({ kind: 'revoke', user }),
    showSecret: setSecret,
    dialogs,
  };
}

const CONFIRM_COPY = {
  reset: (u: UserView) => ({
    title: `Reset password for ${u.username}?`,
    description:
      'A new temporary password will be generated and shown once. They will be signed out everywhere and must choose a new password at next sign-in.',
    confirm: 'Reset password',
  }),
  disable: (u: UserView) => ({
    title: `Disable ${u.username}?`,
    description: 'The account will be signed out immediately and cannot sign in until it is activated again. No data is deleted.',
    confirm: 'Disable account',
  }),
  activate: (u: UserView) => ({
    title: `Activate ${u.username}?`,
    description: 'They will be able to sign in again.',
    confirm: 'Activate account',
  }),
  revoke: (u: UserView) => ({
    title: `Revoke all sessions for ${u.username}?`,
    description: 'Every active session for this account will be ended. They can sign in again with their password.',
    confirm: 'Revoke sessions',
  }),
};
