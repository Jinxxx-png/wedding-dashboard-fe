import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FormField } from '@/components/forms/FormField';
import { adminService } from '@/services/admin.service';
import { applyServerErrors } from '@/utils/errors';
import { useCustomerDirectory, useWebsiteDirectory } from './useDirectories';
import { usernameSchema } from './validation';
import type { UpdateUserInput, UserDetail } from '@/types/api';

const schema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(100, 'Must be at most 100 characters'),
});
type FormValues = z.infer<typeof schema>;

interface EditCustomerDialogProps {
  user: UserDetail | null;
  onOpenChange: (open: boolean) => void;
}

export function EditCustomerDialog({ user, onOpenChange }: EditCustomerDialogProps) {
  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {user && <EditForm user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ user, onDone }: { user: UserDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const directory = useWebsiteDirectory();
  const customers = useCustomerDirectory();
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(user.websiteIds);
  const [filter, setFilter] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: user.username, displayName: user.settings.displayName },
  });

  const websitesChanged =
    selected.length !== user.websiteIds.length || selected.some((id) => !user.websiteIds.includes(id));
  const movedFromOthers = selected
    .map((id) => directory.get(id))
    .filter((w) => w && w.ownerUserId && w.ownerUserId !== user.id);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return directory.websites.filter((w) => !q || w.slug.includes(q) || w.websiteName.toLowerCase().includes(q));
  }, [directory.websites, filter]);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const body: UpdateUserInput = {};
    if (dirtyFields.username) body.username = v.username;
    if (dirtyFields.displayName) body.displayName = v.displayName;
    if (websitesChanged && user.role === 'customer') body.websiteIds = selected;
    if (Object.keys(body).length === 0) {
      onDone();
      return;
    }
    try {
      await adminService.updateUser(user.id, body);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success(user.role === 'admin' ? 'Admin account updated' : 'Customer updated');
      onDone();
    } catch (error) {
      const rest = applyServerErrors(error, setError, {
        fields: ['username', 'displayName'],
        conflictMap: { USERNAME_TAKEN: 'username' },
      });
      if (rest.length) setFormError(rest.join('\n'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{user.role === 'admin' ? 'Edit admin account' : 'Edit customer'}</DialogTitle>
        <DialogDescription>
          {user.role === 'admin'
            ? 'Update the username and display name. Use Make customer on the Accounts page to change the role.'
            : 'Update account details and the websites this customer owns.'}
        </DialogDescription>
      </DialogHeader>
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="whitespace-pre-line">{formError}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Username" required error={errors.username?.message}>
          <Input autoCapitalize="none" spellCheck={false} {...register('username')} />
        </FormField>
        <FormField label="Display name" error={errors.displayName?.message}>
          <Input {...register('displayName')} />
        </FormField>
      </div>

      {user.role === 'customer' && (
        <div className="grid gap-2">
          <Label>Assigned websites</Label>
          <p className="text-xs text-muted-foreground">
            This replaces the full list. Websites selected here are moved from their current owner; unselected websites
            become unassigned.
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter websites…" className="pl-9" />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border">
            {directory.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ) : visible.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No websites found.</p>
            ) : (
              <ul className="divide-y">
                {visible.map((w) => {
                  const checked = selected.includes(w.id);
                  const owner = w.ownerUserId && w.ownerUserId !== user.id ? customers.byId.get(w.ownerUserId) : undefined;
                  return (
                    <li key={w.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSelected((s) => (v === true ? [...s, w.id] : s.filter((id) => id !== w.id)))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{w.websiteName}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            /{w.slug}
                            {owner ? ` · owned by @${owner.username}` : !w.ownerUserId ? ' · unassigned' : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {movedFromOthers.length > 0 && (
            <Alert variant="warning">
              <AlertCircle />
              <AlertDescription>
                {movedFromOthers.length} selected website{movedFromOthers.length === 1 ? ' is' : 's are'} currently owned
                by another customer and will be moved.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
