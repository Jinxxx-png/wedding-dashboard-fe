import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { customerService } from '@/services/customer.service';
import { useInvalidateWebsiteData } from '@/hooks/useInvalidate';
import { notifyError } from '@/utils/errors';
import { RsvpDetailDialog } from './RsvpDetailDialog';
import { RsvpEditDialog } from './RsvpEditDialog';
import type { Rsvp, WebsiteView } from '@/types/api';

interface Options {
  /** Resolves the website (meal options, limits, timezone) for an RSVP. */
  getWebsite: (websiteId: string) => WebsiteView | undefined;
  canEdit?: boolean;
}

/** View / edit / delete flow shared by the customer and admin RSVP pages. */
export function useRsvpActions({ getWebsite, canEdit = true }: Options) {
  const invalidate = useInvalidateWebsiteData();
  const [viewing, setViewing] = useState<Rsvp | null>(null);
  const [editing, setEditing] = useState<Rsvp | null>(null);
  const [deleting, setDeleting] = useState<Rsvp | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await customerService.deleteRsvp(deleting.websiteId, deleting.id);
      await invalidate(deleting.websiteId);
      toast.success('RSVP deleted', { description: `${deleting.guestName}'s RSVP was removed.` });
      setViewing(null);
    } catch (error) {
      notifyError(error, 'Could not delete RSVP');
      throw error;
    }
  };

  const viewingSite = viewing ? getWebsite(viewing.websiteId) : undefined;

  const dialogs = (
    <>
      <RsvpDetailDialog
        rsvp={viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        timezone={viewingSite?.timezone}
        websiteName={viewingSite?.websiteName}
        onEdit={
          canEdit
            ? (r) => {
                setViewing(null);
                setEditing(r);
              }
            : undefined
        }
        onDelete={canEdit ? (r) => setDeleting(r) : undefined}
      />
      <RsvpEditDialog
        rsvp={editing}
        website={editing ? getWebsite(editing.websiteId) : undefined}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this RSVP?"
        description={
          <>
            <span className="font-medium text-foreground">{deleting?.guestName}</span>’s RSVP
            {deleting && deleting.numberOfGuests > 1 ? ` (${deleting.numberOfGuests} guests)` : ''} will be permanently
            removed and attendance figures will be recalculated.
          </>
        }
        confirmLabel="Delete RSVP"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );

  return {
    view: setViewing,
    edit: canEdit ? setEditing : undefined,
    remove: canEdit ? setDeleting : undefined,
    dialogs,
  };
}
