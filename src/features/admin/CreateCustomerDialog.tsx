import { useMemo, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { FormField } from '@/components/forms/FormField';
import { timezoneOptions } from '@/features/account/AccountPreferencesForm';
import { adminService } from '@/services/admin.service';
import { applyServerErrors } from '@/utils/errors';
import { usernameSchema, slugSchema, urlSchema, slugify, optionalDate } from './validation';
import type { CreateCustomerInput, CreateCustomerResult } from '@/types/api';

const accountFields = {
  username: usernameSchema,
  displayName: z.string().trim().max(100, 'Must be at most 100 characters'),
  timezone: z.string().trim(),
  withWebsite: z.boolean(),
};

/** Account only: the website fields are kept in the form (so toggling back restores them) but not validated or sent. */
const accountOnlySchema = z.object({
  ...accountFields,
  websiteName: z.string(),
  websiteSlug: z.string(),
  websiteUrl: z.string(),
  weddingDate: z.string(),
});

const withWebsiteSchema = z.object({
  ...accountFields,
  websiteName: z.string().trim().min(1, 'Website name is required').max(150, 'Must be at most 150 characters'),
  websiteSlug: slugSchema,
  websiteUrl: urlSchema,
  weddingDate: optionalDate,
});

type FormValues = z.infer<typeof withWebsiteSchema>;

const resolver: Resolver<FormValues> = (values, context, options) =>
  values.withWebsite
    ? zodResolver(withWebsiteSchema)(values, context, options)
    : zodResolver(accountOnlySchema)(values, context, options);

const WEBSITE_FIELDS = ['websiteName', 'websiteSlug', 'websiteUrl', 'weddingDate'] as const;
const FIELDS = ['username', 'displayName', 'timezone', ...WEBSITE_FIELDS] as const;

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
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver,
    defaultValues: {
      username: '',
      displayName: '',
      timezone: '',
      withWebsite: false,
      websiteName: '',
      websiteSlug: '',
      websiteUrl: 'https://',
      weddingDate: '',
    },
  });

  const withWebsite = watch('withWebsite');
  const websiteName = register('websiteName');
  const slug = register('websiteSlug');

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    // The API decodes bodies strictly, so only send the website fields when creating one.
    const body: CreateCustomerInput = { username: v.username };
    if (v.displayName) body.displayName = v.displayName;
    if (v.timezone) body.timezone = v.timezone;
    if (v.withWebsite) {
      body.websiteName = v.websiteName;
      body.websiteSlug = v.websiteSlug;
      body.websiteUrl = v.websiteUrl;
      if (v.weddingDate) body.weddingDate = v.weddingDate;
    }
    try {
      const result = await adminService.createCustomer(body);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
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
          Creates the customer account with a temporary password for you to deliver securely. You can create their wedding
          website now, or assign one later from Edit customer.
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
        <FormField label="Timezone" error={errors.timezone?.message} description="Defaults to the server timezone" className="sm:col-span-2">
          <Input list="create-customer-tz" autoComplete="off" placeholder="Asia/Kuala_Lumpur" {...register('timezone')} />
        </FormField>
        <datalist id="create-customer-tz">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </div>

      <Separator />

      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <Label htmlFor="create-customer-with-website">Create a wedding website now</Label>
          <p className="text-xs text-muted-foreground">
            {withWebsite
              ? 'The website will use the timezone above.'
              : 'Leave off to create the account only and assign a website later.'}
          </p>
        </div>
        <Controller
          control={control}
          name="withWebsite"
          render={({ field }) => (
            <Switch
              id="create-customer-with-website"
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                if (!checked) clearErrors([...WEBSITE_FIELDS]);
              }}
            />
          )}
        />
      </div>

      {withWebsite && (
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
        </div>
      )}

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
