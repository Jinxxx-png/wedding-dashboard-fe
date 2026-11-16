import { useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/forms/FormField';
import { customerService } from '@/services/customer.service';
import { useInvalidateWebsiteData } from '@/hooks/useInvalidate';
import { applyServerErrors } from '@/utils/errors';
import { humanize } from '@/utils/format';
import type { GuestType, Rsvp, RsvpInput, WebsiteView } from '@/types/api';

const NO_MEAL = '__none__';
const FIELDS = [
  'guestName',
  'phoneNumber',
  'attendanceStatus',
  'numberOfGuests',
  'guestDetails',
  'mealPreference',
  'dietaryRequirements',
  'notes',
] as const;

function buildSchema(website: WebsiteView) {
  const max = website.rsvpSettings.maxGuestsPerRsvp || 10;
  return z
    .object({
      guestName: z.string().trim().min(1, 'Guest name is required').max(150, 'Must be at most 150 characters'),
      phoneNumber: z.string().trim().max(32, 'Must be at most 32 characters'),
      attendanceStatus: z.enum(['attending', 'not_attending']),
      numberOfGuests: z.number({ error: 'Enter a number' }).int().min(1, 'At least 1').max(max, `At most ${max} per RSVP`),
      includeDetails: z.boolean(),
      guestDetails: z.array(
        z.object({
          name: z.string().trim().min(1, 'Name is required').max(150),
          type: z.enum(['adult', 'child', 'infant']),
        }),
      ),
      mealPreference: z.string(),
      dietaryRequirements: z.string().max(500, 'Must be at most 500 characters'),
      notes: z.string().max(2000, 'Must be at most 2000 characters'),
    })
    .superRefine((v, ctx) => {
      if (website.rsvpSettings.requirePhone && !v.phoneNumber) {
        ctx.addIssue({ code: 'custom', path: ['phoneNumber'], message: 'Phone number is required for this website' });
      }
      if (v.includeDetails && v.guestDetails.length !== v.numberOfGuests) {
        ctx.addIssue({ code: 'custom', path: ['guestDetails'], message: 'Guest details must match the number of guests' });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

function toFormValues(rsvp: Rsvp): FormValues {
  const details = rsvp.guestDetails ?? [];
  return {
    guestName: rsvp.guestName,
    phoneNumber: rsvp.phoneNumber ?? '',
    attendanceStatus: rsvp.attendanceStatus,
    numberOfGuests: rsvp.numberOfGuests,
    includeDetails: details.length > 0,
    guestDetails: details.map((g) => ({ name: g.name, type: g.type })),
    mealPreference: rsvp.mealPreference || NO_MEAL,
    dietaryRequirements: rsvp.dietaryRequirements ?? '',
    notes: rsvp.notes ?? '',
  };
}

interface RsvpEditDialogProps {
  rsvp: Rsvp | null;
  website: WebsiteView | undefined;
  onOpenChange: (open: boolean) => void;
}

export function RsvpEditDialog({ rsvp, website, onOpenChange }: RsvpEditDialogProps) {
  return (
    <Dialog open={rsvp !== null && Boolean(website)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {rsvp && website && <EditForm rsvp={rsvp} website={website} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ rsvp, website, onDone }: { rsvp: Rsvp; website: WebsiteView; onDone: () => void }) {
  const invalidate = useInvalidateWebsiteData();
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(() => buildSchema(website), [website]);
  const mealOptions = website.rsvpSettings.mealOptions;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(rsvp) });

  const { fields, append, remove } = useFieldArray({ control, name: 'guestDetails' });
  const status = watch('attendanceStatus');
  const count = watch('numberOfGuests');
  const includeDetails = watch('includeDetails');
  const guestName = watch('guestName');

  // Keep the guest list length in sync with the number of guests.
  useEffect(() => {
    if (!includeDetails) return;
    const n = Number.isFinite(count) ? Math.max(0, Math.min(count, 50)) : 0;
    if (fields.length < n) {
      for (let i = fields.length; i < n; i++) {
        append({ name: i === 0 ? guestName : '', type: 'adult' as GuestType }, { shouldFocus: false });
      }
    } else if (fields.length > n) {
      remove(Array.from({ length: fields.length - n }, (_, i) => n + i));
    }
  }, [count, includeDetails, fields.length, append, remove, guestName]);

  useEffect(() => {
    if (status === 'not_attending') setValue('mealPreference', NO_MEAL);
  }, [status, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const body: RsvpInput = {
      guestName: v.guestName,
      phoneNumber: v.phoneNumber || undefined,
      attendanceStatus: v.attendanceStatus,
      numberOfGuests: v.numberOfGuests,
      guestDetails: v.includeDetails ? v.guestDetails : undefined,
      mealPreference: v.attendanceStatus === 'attending' && v.mealPreference !== NO_MEAL ? v.mealPreference : undefined,
      dietaryRequirements: v.dietaryRequirements,
      notes: v.notes,
    };
    try {
      await customerService.updateRsvp(rsvp.websiteId, rsvp.id, body);
      await invalidate(rsvp.websiteId);
      toast.success('RSVP updated', { description: `${v.guestName}'s RSVP was saved.` });
      onDone();
    } catch (error) {
      const rest = applyServerErrors(error, setError, { fields: FIELDS });
      if (rest.length) setFormError(rest.join('\n'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Edit RSVP</DialogTitle>
        <DialogDescription>Changes replace the whole RSVP. Analytics update automatically.</DialogDescription>
      </DialogHeader>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="whitespace-pre-line">{formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Guest name" required error={errors.guestName?.message}>
          <Input {...register('guestName')} />
        </FormField>
        <FormField label="Phone number" required={website.rsvpSettings.requirePhone} error={errors.phoneNumber?.message}>
          <Input inputMode="tel" {...register('phoneNumber')} />
        </FormField>
        <FormField label="Attendance" error={errors.attendanceStatus?.message}>
          <Controller
            control={control}
            name="attendanceStatus"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attending">Attending</SelectItem>
                  <SelectItem value="not_attending">Not attending</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          label="Number of guests"
          error={errors.numberOfGuests?.message}
          description={`Including the main guest · max ${website.rsvpSettings.maxGuestsPerRsvp}`}
        >
          <Input type="number" min={1} max={website.rsvpSettings.maxGuestsPerRsvp} {...register('numberOfGuests', { valueAsNumber: true })} />
        </FormField>
        <FormField label="Meal preference" error={errors.mealPreference?.message}>
          <Controller
            control={control}
            name="mealPreference"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={status !== 'attending'}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MEAL}>No preference</SelectItem>
                  {mealOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {humanize(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Dietary restrictions" error={errors.dietaryRequirements?.message}>
          <Input {...register('dietaryRequirements')} placeholder="e.g. No peanuts" />
        </FormField>
      </div>

      <div className="grid gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="include-details">Individual guest details</Label>
            <p className="mt-1 text-xs text-muted-foreground">Record each person’s name and type (adult, child, infant).</p>
          </div>
          <Controller
            control={control}
            name="includeDetails"
            render={({ field }) => <Switch id="include-details" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
        {includeDetails && (
          <div className="grid gap-2">
            {fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1.5rem_1fr_8rem] items-start gap-2">
                <span className="pt-2 text-xs text-muted-foreground tabular">{i + 1}.</span>
                <div>
                  <Input
                    aria-label={`Guest ${i + 1} name`}
                    aria-invalid={errors.guestDetails?.[i]?.name ? true : undefined}
                    {...register(`guestDetails.${i}.name` as const)}
                  />
                  {errors.guestDetails?.[i]?.name && (
                    <p className="mt-1 text-xs text-destructive">{errors.guestDetails[i]?.name?.message}</p>
                  )}
                </div>
                <Controller
                  control={control}
                  name={`guestDetails.${i}.type` as const}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" aria-label={`Guest ${i + 1} type`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adult">Adult</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="infant">Infant</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ))}
            {errors.guestDetails?.message && <p className="text-xs text-destructive">{errors.guestDetails.message}</p>}
          </div>
        )}
      </div>

      <FormField label="Notes" error={errors.notes?.message}>
        <Textarea rows={3} {...register('notes')} />
      </FormField>

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
