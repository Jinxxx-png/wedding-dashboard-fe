import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/forms/FormField';
import { customerService } from '@/services/customer.service';
import { useAuth } from '@/contexts/AuthContext';
import { applyServerErrors, notifyError } from '@/utils/errors';
import { queryKeys } from '@/lib/query';
import type { AccountSettingsInput, UserView } from '@/types/api';

const schema = z.object({
  displayName: z.string().trim().max(100, 'Must be at most 100 characters'),
  timezone: z.string().trim(),
  defaultExportFormat: z.enum(['xlsx', 'csv']),
  defaultPageSize: z.number({ error: 'Enter a number' }).int().min(5, 'Minimum 5').max(100, 'Maximum 100'),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = ['displayName', 'timezone', 'defaultExportFormat', 'defaultPageSize'] as const;

export function timezoneOptions(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return fn('timeZone');
  } catch {
    /* older browsers */
  }
  return ['UTC', 'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Jakarta', 'Europe/London', 'America/New_York'];
}

/** Account preferences (`PUT /customer/settings`). Username and role are not editable. */
export function AccountPreferencesForm({ user }: { user: UserView }) {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const zones = useMemo(timezoneOptions, []);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user.settings.displayName,
      timezone: user.settings.timezone,
      defaultExportFormat: user.settings.defaultExportFormat || 'xlsx',
      defaultPageSize: user.settings.defaultPageSize || 20,
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    // Send only what changed (strict request bodies).
    const body: AccountSettingsInput = {};
    if (dirtyFields.displayName) body.displayName = v.displayName;
    if (dirtyFields.timezone) body.timezone = v.timezone;
    if (dirtyFields.defaultExportFormat) body.defaultExportFormat = v.defaultExportFormat;
    if (dirtyFields.defaultPageSize) body.defaultPageSize = v.defaultPageSize;
    try {
      const updated = await customerService.updateSettings(body);
      updateUser(updated);
      queryClient.setQueryData(queryKeys.customer.settings, updated);
      reset({
        displayName: updated.settings.displayName,
        timezone: updated.settings.timezone,
        defaultExportFormat: updated.settings.defaultExportFormat || 'xlsx',
        defaultPageSize: updated.settings.defaultPageSize || 20,
      });
      toast.success('Preferences saved');
    } catch (error) {
      const rest = applyServerErrors(error, setError, { fields: FIELDS });
      if (rest.length) notifyError(error, 'Could not save preferences');
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Display name" error={errors.displayName?.message} description="Shown in the dashboard header.">
          <Input {...register('displayName')} placeholder="e.g. Luqman & Amin" />
        </FormField>
        <FormField label="Timezone" error={errors.timezone?.message} description="IANA name, e.g. Asia/Kuala_Lumpur">
          <Input list="tz-options" {...register('timezone')} autoComplete="off" />
        </FormField>
        <datalist id="tz-options">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <FormField label="Default export format" error={errors.defaultExportFormat?.message}>
          <Controller
            control={control}
            name="defaultExportFormat"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Default rows per page" error={errors.defaultPageSize?.message} description="Between 5 and 100.">
          <Input type="number" min={5} max={100} {...register('defaultPageSize', { valueAsNumber: true })} />
        </FormField>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Save preferences
        </Button>
        {isDirty && (
          <Button variant="ghost" onClick={() => reset()} disabled={isSubmitting}>
            Discard
          </Button>
        )}
      </div>
    </form>
  );
}
