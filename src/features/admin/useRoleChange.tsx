import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { adminService } from '@/services/admin.service';
import { queryKeys } from '@/lib/query';
import { notifyError } from '@/utils/errors';
import { useWebsiteDirectory } from './useDirectories';
import type { Role, UserView } from '@/types/api';

type Pending = { user: UserView; role: Role } | null;

/**
 * Promote a customer to admin or change an admin to a customer (`POST /admin/users/:id/role`).
 * Always confirmed first. The backend refuses changing your own role and demoting the last active admin.
 */
export function useRoleChange() {
  const queryClient = useQueryClient();
  const directory = useWebsiteDirectory();
  const [pending, setPending] = useState<Pending>(null);

  const run = async () => {
    if (!pending) return;
    const { user, role } = pending;
    try {
      await adminService.changeRole(user.id, { role });
      // Role changes move websites and change user counts, so refresh everything admin-side.
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      toast.success(role === 'admin' ? `@${user.username} is now an admin` : `@${user.username} is now a customer`, {
        description: 'They were signed out and will get the new access the next time they sign in.',
      });
    } catch (error) {
      notifyError(error, 'Could not change the role');
      throw error;
    }
  };

  const target = pending?.user;
  const promoting = pending?.role === 'admin';
  const ownedSites = promoting && target ? target.websiteIds.map((id) => directory.get(id)).filter((w) => w !== undefined) : [];
  const ownedCount = promoting && target ? target.websiteIds.length : 0;

  const description = target ? (
    <div className="space-y-3">
      <p>
        {promoting
          ? 'They will get full access to the admin console: every account, website, RSVP, wish and the audit log.'
          : 'They will lose access to the admin console and only see the websites you assign to them.'}{' '}
        They will be signed out everywhere and must sign in again.
      </p>
      {ownedCount > 0 && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>
            <p>
              Admins can’t own websites, so {ownedCount === 1 ? 'this website' : `these ${ownedCount} websites`} will become
              unassigned. The wedding sites keep working; reassign them from Websites or Edit customer.
            </p>
            {ownedSites.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {ownedSites.map((w) => (
                  <li key={w.id}>
                    {w.websiteName} <span className="text-muted-foreground">/{w.slug}</span>
                  </li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  ) : null;

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(o) => !o && setPending(null)}
      title={target ? (promoting ? `Make @${target.username} an admin?` : `Change @${target.username} to a customer?`) : ''}
      description={description}
      confirmLabel={promoting ? 'Make admin' : 'Make customer'}
      destructive={!promoting}
      onConfirm={run}
    />
  );

  return {
    changeRole: (user: UserView, role: Role) => setPending({ user, role }),
    dialog,
  };
}
