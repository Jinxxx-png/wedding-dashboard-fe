import { useQuery } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AttendanceBadge, GuestTypeBadge } from '@/components/shared/StatusBadges';
import { InfoList } from '@/components/shared/InfoList';
import { customerService } from '@/services/customer.service';
import { queryKeys } from '@/lib/query';
import { formatDateTime, formatPhone, humanize } from '@/utils/format';
import type { Rsvp } from '@/types/api';

interface RsvpDetailDialogProps {
  rsvp: Rsvp | null;
  onOpenChange: (open: boolean) => void;
  timezone?: string;
  websiteName?: string;
  onEdit?: (rsvp: Rsvp) => void;
  onDelete?: (rsvp: Rsvp) => void;
}

/** Full RSVP details. Refreshes from `GET …/rsvps/:id`, starting from the list row. */
export function RsvpDetailDialog({ rsvp, onOpenChange, timezone, websiteName, onEdit, onDelete }: RsvpDetailDialogProps) {
  const detail = useQuery({
    queryKey: queryKeys.website.rsvp(rsvp?.websiteId ?? '', rsvp?.id ?? ''),
    queryFn: () => customerService.rsvp(rsvp!.websiteId, rsvp!.id),
    enabled: Boolean(rsvp),
    initialData: rsvp ?? undefined,
    staleTime: 10_000,
  });
  const data = detail.data ?? rsvp;
  const guests = data?.guestDetails ?? [];
  const additional = data ? Math.max(data.numberOfGuests - Math.max(guests.length, 1), 0) : 0;

  return (
    <Dialog open={rsvp !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {data && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg">{data.guestName}</DialogTitle>
                <AttendanceBadge status={data.attendanceStatus} />
              </div>
              <DialogDescription>
                Submitted {formatDateTime(data.createdAt, timezone)}
                {websiteName ? ` · ${websiteName}` : ''}
              </DialogDescription>
            </DialogHeader>

            <InfoList
              columns={2}
              items={[
                { label: 'Phone number', value: formatPhone(data.phoneNumber) },
                {
                  label: 'Number of attendees',
                  value: `${data.numberOfGuests} ${data.numberOfGuests === 1 ? 'person' : 'people'}`,
                  hint: 'Including the main guest',
                },
                { label: 'Meal preference', value: data.attendanceStatus === 'attending' ? humanize(data.mealPreference) : '—' },
                { label: 'Dietary restrictions', value: data.dietaryRequirements || '—' },
              ]}
            />

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Guest details</p>
              {guests.length > 0 ? (
                <ul className="divide-y rounded-lg border">
                  {guests.map((g, i) => (
                    <li key={`${g.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-5 text-xs text-muted-foreground tabular">{i + 1}.</span>
                        <span className="truncate">{g.name}</span>
                        {i === 0 && <span className="text-xs text-muted-foreground">(main guest)</span>}
                      </span>
                      <GuestTypeBadge type={g.type} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                  No individual guest names were provided
                  {additional > 0 ? ` — ${data.guestName} plus ${additional} additional guest${additional === 1 ? '' : 's'}.` : '.'}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm whitespace-pre-wrap">{data.notes || '—'}</p>
            </div>

            <p className="text-xs text-muted-foreground">
              Source: {humanize(data.source)} · Last updated {formatDateTime(data.updatedAt, timezone)}
            </p>

            {(onEdit || onDelete) && (
              <DialogFooter>
                {onDelete && (
                  <Button variant="outline" className="text-destructive hover:text-destructive sm:mr-auto" onClick={() => onDelete(data)}>
                    <Trash2 /> Delete
                  </Button>
                )}
                {onEdit && (
                  <Button onClick={() => onEdit(data)}>
                    <Pencil /> Edit RSVP
                  </Button>
                )}
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
