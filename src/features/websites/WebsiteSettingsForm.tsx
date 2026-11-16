import type { ReactNode } from 'react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/forms/FormField';
import { applyServerErrors, notifyError } from '@/utils/errors';
import { humanize } from '@/utils/format';
import type { DuplicatePolicy, WebsiteSettingsInput, WebsiteView } from '@/types/api';

const MEAL_RE = /^[a-z0-9_]{1,40}$/;

const schema = z.object({
  acceptingRsvps: z.boolean(),
  rsvpDeadline: z.string(),
  maxGuestsPerRsvp: z.number({ error: 'Enter a number' }).int().min(1, 'Minimum 1').max(50, 'Maximum 50'),
  mealOptions: z
    .array(z.string().regex(MEAL_RE, 'Lowercase letters, digits and _ only (max 40)'))
    .min(1, 'Add at least one meal option')
    .max(30, 'At most 30 meal options'),
  duplicatePolicy: z.enum(['update', 'reject', 'allow']),
  requirePhone: z.boolean(),
  acceptingWishes: z.boolean(),
  autoApprove: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const FIELDS = ['acceptingRsvps', 'rsvpDeadline', 'maxGuestsPerRsvp', 'mealOptions', 'duplicatePolicy', 'requirePhone', 'acceptingWishes', 'autoApprove'] as const;
const FIELD_MAP: Record<string, string> = {
  'rsvpSettings.acceptingRsvps': 'acceptingRsvps',
  'rsvpSettings.rsvpDeadline': 'rsvpDeadline',
  'rsvpSettings.maxGuestsPerRsvp': 'maxGuestsPerRsvp',
  'rsvpSettings.mealOptions': 'mealOptions',
  'rsvpSettings.duplicatePolicy': 'duplicatePolicy',
  'rsvpSettings.requirePhone': 'requirePhone',
  'wishSettings.acceptingWishes': 'acceptingWishes',
  'wishSettings.autoApprove': 'autoApprove',
};

const DUPLICATE_HELP: Record<DuplicatePolicy, string> = {
  update: 'A guest resubmitting with the same phone number replaces their RSVP.',
  reject: 'A second submission with the same phone number is refused.',
  allow: 'Every submission is kept, even with the same phone number.',
};

/** RFC 3339 → value for <input type="datetime-local"> (browser local time). */
function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value → RFC 3339 with the browser's UTC offset ("" clears the deadline). */
function fromLocalInput(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return `${value}:00${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

function toValues(w: WebsiteView): FormValues {
  return {
    acceptingRsvps: w.rsvpSettings.acceptingRsvps,
    rsvpDeadline: toLocalInput(w.rsvpSettings.rsvpDeadline),
    maxGuestsPerRsvp: w.rsvpSettings.maxGuestsPerRsvp,
    mealOptions: [...w.rsvpSettings.mealOptions],
    duplicatePolicy: w.rsvpSettings.duplicatePolicy,
    requirePhone: w.rsvpSettings.requirePhone,
    acceptingWishes: w.wishSettings.acceptingWishes,
    autoApprove: w.wishSettings.autoApprove,
  };
}

interface WebsiteSettingsFormProps {
  website: WebsiteView;
  /** Persists the change (customer: PUT settings, admin: PUT website). Returns the updated website. */
  onSave: (body: WebsiteSettingsInput) => Promise<WebsiteView>;
}

/** RSVP + wish settings. Sends only changed fields (the API rejects unknown keys). */
export function WebsiteSettingsForm({ website, onSave }: WebsiteSettingsFormProps) {
  const [mealDraft, setMealDraft] = useState('');
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toValues(website) });

  const meals = watch('mealOptions');
  const policy = watch('duplicatePolicy');

  const addMeal = () => {
    const value = mealDraft.trim().toLowerCase().replace(/\s+/g, '_');
    if (!value) return;
    if (!MEAL_RE.test(value)) {
      setError('mealOptions', { message: 'Lowercase letters, digits and _ only (max 40)' });
      return;
    }
    if (!meals.includes(value)) setValue('mealOptions', [...meals, value], { shouldDirty: true, shouldValidate: true });
    setMealDraft('');
  };

  const onSubmit = handleSubmit(async (v) => {
    const rsvp: NonNullable<WebsiteSettingsInput['rsvpSettings']> = {};
    if (dirtyFields.acceptingRsvps) rsvp.acceptingRsvps = v.acceptingRsvps;
    if (dirtyFields.rsvpDeadline) rsvp.rsvpDeadline = fromLocalInput(v.rsvpDeadline);
    if (dirtyFields.maxGuestsPerRsvp) rsvp.maxGuestsPerRsvp = v.maxGuestsPerRsvp;
    if (dirtyFields.mealOptions) rsvp.mealOptions = v.mealOptions;
    if (dirtyFields.duplicatePolicy) rsvp.duplicatePolicy = v.duplicatePolicy;
    if (dirtyFields.requirePhone) rsvp.requirePhone = v.requirePhone;
    const wish: NonNullable<WebsiteSettingsInput['wishSettings']> = {};
    if (dirtyFields.acceptingWishes) wish.acceptingWishes = v.acceptingWishes;
    if (dirtyFields.autoApprove) wish.autoApprove = v.autoApprove;

    const body: WebsiteSettingsInput = {};
    if (Object.keys(rsvp).length) body.rsvpSettings = rsvp;
    if (Object.keys(wish).length) body.wishSettings = wish;

    try {
      const updated = await onSave(body);
      reset(toValues(updated));
      toast.success('Website settings saved');
    } catch (error) {
      const rest = applyServerErrors(error, setError, { fields: FIELDS, fieldMap: FIELD_MAP });
      if (rest.length) notifyError(error, 'Could not save settings');
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <section className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold">RSVP form</h3>
          <p className="text-[13px] text-muted-foreground">How guests can respond on your wedding website.</p>
        </div>
        <ToggleRow
          id="accepting-rsvps"
          label="Accept RSVPs"
          description="Turn off to close the RSVP form."
          control={<Controller control={control} name="acceptingRsvps" render={({ field }) => <Switch id="accepting-rsvps" checked={field.value} onCheckedChange={field.onChange} />} />}
        />
        <ToggleRow
          id="require-phone"
          label="Require phone number"
          description="Used to detect duplicate submissions."
          control={<Controller control={control} name="requirePhone" render={({ field }) => <Switch id="require-phone" checked={field.value} onCheckedChange={field.onChange} />} />}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="RSVP deadline" error={errors.rsvpDeadline?.message} description="Leave empty for no deadline. Uses your browser’s timezone.">
            <Input type="datetime-local" {...register('rsvpDeadline')} />
          </FormField>
          <FormField label="Max guests per RSVP" error={errors.maxGuestsPerRsvp?.message} description="Including the main guest (1–50).">
            <Input type="number" min={1} max={50} {...register('maxGuestsPerRsvp', { valueAsNumber: true })} />
          </FormField>
          <FormField label="Duplicate submissions" error={errors.duplicatePolicy?.message} description={DUPLICATE_HELP[policy]}>
            <Controller
              control={control}
              name="duplicatePolicy"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">Update existing RSVP</SelectItem>
                    <SelectItem value="reject">Reject duplicates</SelectItem>
                    <SelectItem value="allow">Allow duplicates</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="meal-input">Meal options</Label>
          <div className="flex flex-wrap gap-1.5">
            {meals.map((m) => (
              <Badge key={m} variant="secondary" className="gap-1 py-1 pr-1">
                {humanize(m)}
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-zinc-200"
                  aria-label={`Remove ${humanize(m)}`}
                  onClick={() => setValue('mealOptions', meals.filter((x) => x !== m), { shouldDirty: true, shouldValidate: true })}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex max-w-sm gap-2">
            <Input
              id="meal-input"
              value={mealDraft}
              onChange={(e) => setMealDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMeal();
                }
              }}
              placeholder="e.g. vegetarian"
            />
            <Button variant="outline" onClick={addMeal}>
              <Plus /> Add
            </Button>
          </div>
          {errors.mealOptions && (
            <p className="text-xs text-destructive" role="alert">
              {errors.mealOptions.message ?? errors.mealOptions.root?.message ?? 'Invalid meal options'}
            </p>
          )}
        </div>
      </section>

      <Separator />

      <section className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold">Wedding wishes</h3>
          <p className="text-[13px] text-muted-foreground">Guest messages on your wedding website.</p>
        </div>
        <ToggleRow
          id="accepting-wishes"
          label="Accept wishes"
          description="Turn off to close the wishes form."
          control={<Controller control={control} name="acceptingWishes" render={({ field }) => <Switch id="accepting-wishes" checked={field.value} onCheckedChange={field.onChange} />} />}
        />
        <ToggleRow
          id="auto-approve"
          label="Auto-approve wishes"
          description="When off, new wishes stay hidden until you approve them."
          control={<Controller control={control} name="autoApprove" render={({ field }) => <Switch id="auto-approve" checked={field.value} onCheckedChange={field.onChange} />} />}
        />
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Save settings
        </Button>
        {isDirty && (
          <Button variant="ghost" onClick={() => reset(toValues(website))} disabled={isSubmitting}>
            Discard changes
          </Button>
        )}
      </div>
    </form>
  );
}

function ToggleRow({ id, label, description, control }: { id: string; label: string; description: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  );
}
