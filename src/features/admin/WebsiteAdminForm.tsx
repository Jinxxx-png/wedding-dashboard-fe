import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/forms/FormField';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { timezoneOptions } from '@/features/account/AccountPreferencesForm';
import { adminService } from '@/services/admin.service';
import { applyServerErrors } from '@/utils/errors';
import { queryKeys } from '@/lib/query';
import { useCustomerDirectory } from './useDirectories';
import { optionalDate, slugSchema, urlSchema } from './validation';
import type { AdminWebsiteUpdate, WebsiteView } from '@/types/api';

const UNASSIGNED = '__none__';

const schema = z.object({
  websiteName: z.string().trim().min(1, 'Website name is required').max(150),
  slug: slugSchema,
  websiteUrl: urlSchema,
  weddingDate: optionalDate,
  timezone: z.string().trim(),
  ownerUserId: z.string(),
  mode: z.enum(['browser', 'signed']),
  allowedOrigins: z.string().refine(
    (v) =>
      v
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .every((o) => /^https?:\/\/[^/\s]+$/.test(o)),
    'One origin per line, e.g. https://ahmad-sarah.com (no path)',
  ),
  captchaRequired: z.boolean(),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = ['websiteName', 'slug', 'websiteUrl', 'weddingDate', 'timezone', 'ownerUserId', 'mode', 'allowedOrigins', 'captchaRequired'] as const;
const FIELD_MAP = {
  'integration.mode': 'mode',
  'integration.allowedOrigins': 'allowedOrigins',
  'integration.captchaRequired': 'captchaRequired',
};

function toValues(w: WebsiteView): FormValues {
  return {
    websiteName: w.websiteName,
    slug: w.slug,
    websiteUrl: w.websiteUrl,
    weddingDate: w.weddingDate ?? '',
    timezone: w.timezone,
    ownerUserId: w.ownerUserId || UNASSIGNED,
    mode: w.integration.mode,
    allowedOrigins: w.integration.allowedOrigins.join('\n'),
    captchaRequired: w.integration.captchaRequired,
  };
}

/** Admin-only website fields: identity, owner and integration. Sends only changed fields. */
export function WebsiteAdminForm({ website }: { website: WebsiteView }) {
  const queryClient = useQueryClient();
  const customers = useCustomerDirectory();
  const zones = useMemo(timezoneOptions, []);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingBody, setPendingBody] = useState<AdminWebsiteUpdate | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toValues(website) });
  const slug = watch('slug');

  const save = async (body: AdminWebsiteUpdate) => {
    setFormError(null);
    try {
      const updated = await adminService.updateWebsite(website.id, body);
      queryClient.setQueryData(queryKeys.admin.website(website.id), updated);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.website.all(website.id) });
      reset(toValues(updated));
      toast.success('Website updated');
    } catch (error) {
      const rest = applyServerErrors(error, setError, { fields: FIELDS, fieldMap: FIELD_MAP, conflictMap: { SLUG_TAKEN: 'slug' } });
      if (rest.length) setFormError(rest.join('\n'));
      throw error;
    }
  };

  const onSubmit = handleSubmit(async (v) => {
    const body: AdminWebsiteUpdate = {};
    if (dirtyFields.websiteName) body.websiteName = v.websiteName;
    if (dirtyFields.slug) body.slug = v.slug;
    if (dirtyFields.websiteUrl) body.websiteUrl = v.websiteUrl;
    if (dirtyFields.weddingDate) body.weddingDate = v.weddingDate; // "" clears
    if (dirtyFields.timezone) body.timezone = v.timezone;
    if (dirtyFields.ownerUserId) body.ownerUserId = v.ownerUserId === UNASSIGNED ? '' : v.ownerUserId;
    const integration: NonNullable<AdminWebsiteUpdate['integration']> = {};
    if (dirtyFields.mode) integration.mode = v.mode;
    if (dirtyFields.allowedOrigins)
      integration.allowedOrigins = v.allowedOrigins
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (dirtyFields.captchaRequired) integration.captchaRequired = v.captchaRequired;
    if (Object.keys(integration).length) body.integration = integration;

    // Changing the slug breaks the live wedding website until it is updated → confirm first.
    if (body.slug && body.slug !== website.slug) {
      setPendingBody(body);
      return;
    }
    await save(body).catch(() => undefined);
  });

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-6" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription className="whitespace-pre-line">{formError}</AlertDescription>
          </Alert>
        )}
        <section className="grid gap-4 sm:grid-cols-2">
          <FormField label="Website name" required error={errors.websiteName?.message} className="sm:col-span-2">
            <Input {...register('websiteName')} />
          </FormField>
          <FormField
            label="Slug"
            required
            error={errors.slug?.message}
            description={slug !== website.slug ? undefined : 'Used by the wedding website to submit RSVPs and wishes.'}
          >
            <Input autoCapitalize="none" spellCheck={false} {...register('slug')} />
          </FormField>
          <FormField label="Website URL" required error={errors.websiteUrl?.message}>
            <Input type="url" {...register('websiteUrl')} />
          </FormField>
          {slug !== website.slug && (
            <Alert variant="warning" className="sm:col-span-2">
              <AlertTriangle />
              <AlertDescription>
                Changing the slug breaks the wedding website immediately — the old slug stops working until the site is
                updated.
              </AlertDescription>
            </Alert>
          )}
          <FormField label="Wedding date" error={errors.weddingDate?.message} description="Clear to remove the date.">
            <Input type="date" {...register('weddingDate')} />
          </FormField>
          <FormField label="Timezone" error={errors.timezone?.message}>
            <Input list="site-admin-tz" autoComplete="off" {...register('timezone')} />
          </FormField>
          <datalist id="site-admin-tz">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          <FormField label="Owner" error={errors.ownerUserId?.message} description="Only customers can own websites.">
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
        </section>

        <Separator />

        <section className="grid gap-4">
          <div>
            <h3 className="text-sm font-semibold">Integration</h3>
            <p className="text-[13px] text-muted-foreground">How the wedding website submits RSVPs and wishes.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Mode"
              error={errors.mode?.message}
              description="Browser: the site calls the API from visitors' browsers. Signed: server-to-server signed requests only."
            >
              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="browser">Browser</SelectItem>
                      <SelectItem value="signed">Signed (server-to-server)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <div className="flex items-center justify-between gap-3 self-start rounded-lg border px-4 py-3">
              <div>
                <Label htmlFor="captcha">Require CAPTCHA</Label>
                <p className="mt-1 text-xs text-muted-foreground">Only if the server has a CAPTCHA provider configured.</p>
                {errors.captchaRequired?.message && <p className="mt-1 text-xs text-destructive">{errors.captchaRequired.message}</p>}
              </div>
              <Controller
                control={control}
                name="captchaRequired"
                render={({ field }) => <Switch id="captcha" checked={field.value} onCheckedChange={field.onChange} />}
              />
            </div>
            <FormField
              label="Allowed origins"
              error={errors.allowedOrigins?.message}
              description="One per line. When set, browser submissions from other origins are rejected."
              className="sm:col-span-2"
            >
              <Textarea rows={3} placeholder={'https://ahmad-sarah.com\nhttps://www.ahmad-sarah.com'} className="font-mono text-xs" {...register('allowedOrigins')} />
            </FormField>
          </div>
        </section>

        <div className="flex gap-2">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
          {isDirty && (
            <Button variant="ghost" onClick={() => reset(toValues(website))} disabled={isSubmitting}>
              Discard changes
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={pendingBody !== null}
        onOpenChange={(o) => !o && setPendingBody(null)}
        title="Change the website slug?"
        description={
          <>
            The slug will change from <code className="font-mono">{website.slug}</code> to{' '}
            <code className="font-mono">{pendingBody?.slug}</code>. The wedding website stops working with the old slug
            immediately and must be updated.
          </>
        }
        confirmLabel="Change slug"
        destructive
        onConfirm={async () => {
          if (pendingBody) await save(pendingBody);
        }}
      />
    </>
  );
}
