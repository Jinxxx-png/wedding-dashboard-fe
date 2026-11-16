import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { FormField } from '@/components/forms/FormField';
import { timezoneOptions } from '@/features/account/AccountPreferencesForm';
import { adminService } from '@/services/admin.service';
import { applyServerErrors } from '@/utils/errors';
import { usernameSchema, slugSchema, urlSchema, slugify, optionalDate } from './validation';
import type { CreateCustomerInput, CreateCustomerResult } from '@/types/api';

const schema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(100, 'Must be at most 100 characters'),
  websiteName: z.string().trim().min(1, 'Website name is required').max(150, 'Must be at most 150 characters'),
  websiteSlug: slugSchema,
  websiteUrl: urlSchema,
  weddingDate: optionalDate,
  timezone: z.string().trim(),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = ['username', 'displayName', 'websiteName', 'websiteSlug', 'websiteUrl', 'weddingDate', 'timezone'] as const;

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the result once; the parent shows the temporary password a single time. */
  onCreated: (result: CreateCustomerResult) => void;
}

export function CreateCustomerDialog({ open, onOpenChange, onCreated }: CreateCustomerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && <CreateCustomerForm onCancel={() => onOpenChange(false)} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateCustomerForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (r: CreateCustomerResult) => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const zones = useMemo(timezoneOptions, []);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', displayName: '', websiteName: '', websiteSlug: '', websiteUrl: 'https://', weddingDate: '', timezone: '' },
  });

  const websiteName = register('websiteName');
  const slug = register('websiteSlug');

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const body: CreateCustomerInput = {
      username: v.username,
      websiteName: v.websiteName,
      websiteSlug: v.websiteSlug,
      websiteUrl: v.websiteUrl,
    };
    if (v.displayName) body.displayName = v.displayName;
    if (v.weddingDate) body.weddingDate = v.weddingDate;
    if (v.timezone) body.timezone = v.timezone;
    try {
      const result = await adminService.createCustomer(body);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin'] }),
      ]);
      onCreated(result);
    } catch (error) {
      const rest = applyServerErrors(error, setError, {
        fields: FIELDS,
        conflictMap: { USERNAME_TAKEN: 'username', SLUG_TAKEN: 'websiteSlug' },
        fieldMap: { slug: 'websiteSlug' },
      });
      if (rest.length) setFormError(rest.join('\n'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Create customer</DialogTitle>
        <DialogDescription>
          Creates the customer account and their first wedding website. A temporary password is generated for you to
          deliver securely.
        </DialogDescription>
      </DialogHeader>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="whitespace-pre-line">{formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Username" required error={errors.username?.message} description="3–32 chars: letters, digits, . _ -">
          <Input autoComplete="off" autoCapitalize="none" spellCheck={false} {...register('username')} />
        </FormField>
        <FormField label="Display name" error={errors.displayName?.message}>
          <Input {...register('displayName')} placeholder="Optional" />
        </FormField>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Website name" required error={errors.websiteName?.message} className="sm:col-span-2">
          <Input
            {...websiteName}
            placeholder="e.g. Luqman & Amin"
            onChange={(e) => {
              void websiteName.onChange(e);
              if (!slugTouched) setValue('websiteSlug', slugify(e.target.value), { shouldValidate: false });
            }}
          />
        </FormField>
        <FormField label="Website slug" required error={errors.websiteSlug?.message} description="Lowercase letters, digits and single hyphens">
          <Input
            {...slug}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => {
              setSlugTouched(true);
              void slug.onChange(e);
            }}
          />
        </FormField>
        <FormField label="Website URL" required error={errors.websiteUrl?.message}>
          <Input type="url" inputMode="url" {...register('websiteUrl')} />
        </FormField>
        <FormField label="Wedding date" error={errors.weddingDate?.message}>
          <Input type="date" {...register('weddingDate')} />
        </FormField>
        <FormField label="Timezone" error={errors.timezone?.message} description="Defaults to the server timezone">
          <Input list="create-customer-tz" autoComplete="off" placeholder="Asia/Kuala_Lumpur" {...register('timezone')} />
        </FormField>
        <datalist id="create-customer-tz">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create customer
        </Button>
      </DialogFooter>
    </form>
  );
}
