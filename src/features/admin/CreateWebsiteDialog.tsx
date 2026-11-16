import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/forms/FormField';
import { timezoneOptions } from '@/features/account/AccountPreferencesForm';
import { adminService } from '@/services/admin.service';
import { applyServerErrors } from '@/utils/errors';
import { useCustomerDirectory } from './useDirectories';
import { optionalDate, slugify, slugSchema, urlSchema } from './validation';
import type { CreateWebsiteInput } from '@/types/api';

const UNASSIGNED = '__none__';
const schema = z.object({
  websiteName: z.string().trim().min(1, 'Website name is required').max(150),
  slug: slugSchema,
  websiteUrl: urlSchema,
  ownerUserId: z.string(),
  weddingDate: optionalDate,
  timezone: z.string().trim(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = ['websiteName', 'slug', 'websiteUrl', 'ownerUserId', 'weddingDate', 'timezone', 'isActive'] as const;

export function CreateWebsiteDialog({
  open,
  onOpenChange,
  defaultOwnerId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultOwnerId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && <CreateWebsiteForm onDone={() => onOpenChange(false)} defaultOwnerId={defaultOwnerId} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateWebsiteForm({ onDone, defaultOwnerId }: { onDone: () => void; defaultOwnerId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const customers = useCustomerDirectory();
  const zones = useMemo(timezoneOptions, []);
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      websiteName: '',
      slug: '',
      websiteUrl: 'https://',
      ownerUserId: defaultOwnerId ?? UNASSIGNED,
      weddingDate: '',
      timezone: '',
      isActive: true,
    },
  });
  const nameField = register('websiteName');
  const slugField = register('slug');

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const body: CreateWebsiteInput = { websiteName: v.websiteName, slug: v.slug, websiteUrl: v.websiteUrl, isActive: v.isActive };
    if (v.ownerUserId !== UNASSIGNED) body.ownerUserId = v.ownerUserId;
    if (v.weddingDate) body.weddingDate = v.weddingDate;
    if (v.timezone) body.timezone = v.timezone;
    try {
      const site = await adminService.createWebsite(body);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success('Website created', { description: `${site.websiteName} (/${site.slug})` });
      onDone();
      navigate(`/admin/websites/${site.id}`);
    } catch (error) {
      const rest = applyServerErrors(error, setError, { fields: FIELDS, conflictMap: { SLUG_TAKEN: 'slug' } });
      if (rest.length) setFormError(rest.join('\n'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Create website</DialogTitle>
        <DialogDescription>Add a wedding website and optionally assign it to a customer.</DialogDescription>
      </DialogHeader>
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="whitespace-pre-line">{formError}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Website name" required error={errors.websiteName?.message} className="sm:col-span-2">
          <Input
            {...nameField}
            onChange={(e) => {
              void nameField.onChange(e);
              if (!slugTouched) setValue('slug', slugify(e.target.value));
            }}
          />
        </FormField>
        <FormField label="Slug" required error={errors.slug?.message}>
          <Input
            {...slugField}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => {
              setSlugTouched(true);
              void slugField.onChange(e);
            }}
          />
        </FormField>
        <FormField label="Website URL" required error={errors.websiteUrl?.message}>
          <Input type="url" {...register('websiteUrl')} />
        </FormField>
        <FormField label="Owner" error={errors.ownerUserId?.message}>
          <Controller
            control={control}
            name="ownerUserId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {customers.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      @{c.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Wedding date" error={errors.weddingDate?.message}>
          <Input type="date" {...register('weddingDate')} />
        </FormField>
        <FormField label="Timezone" error={errors.timezone?.message}>
          <Input list="create-website-tz" autoComplete="off" placeholder="Asia/Kuala_Lumpur" {...register('timezone')} />
        </FormField>
        <datalist id="create-website-tz">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <Label htmlFor="new-site-active">Active</Label>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <Switch id="new-site-active" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create website
        </Button>
      </DialogFooter>
    </form>
  );
}
