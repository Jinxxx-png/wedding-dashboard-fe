import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FavouriteBadge, VisibilityBadge } from '@/components/shared/StatusBadges';
import { customerService } from '@/services/customer.service';
import { useInvalidateWebsiteData } from '@/hooks/useInvalidate';
import { notifyError } from '@/utils/errors';
import { formatDateTime, initials } from '@/utils/format';
import type { Wish, WishUpdateInput } from '@/types/api';

interface Options {
  getTimezone?: (websiteId: string) => string | undefined;
  getWebsiteName?: (websiteId: string) => string | undefined;
  canModerate?: boolean;
}

/** View / toggle visibility / favourite / delete for wishes (customer + admin). */
export function useWishActions({ getTimezone, getWebsiteName, canModerate = true }: Options = {}) {
  const invalidate = useInvalidateWebsiteData();
  const [viewing, setViewing] = useState<Wish | null>(null);
  const [deleting, setDeleting] = useState<Wish | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: ({ wish, body }: { wish: Wish; body: WishUpdateInput }) =>
      customerService.updateWish(wish.websiteId, wish.id, body),
    onMutate: ({ wish }) => setPendingId(wish.id),
    onSuccess: async (updated, { body }) => {
      await invalidate(updated.websiteId);
      setViewing((v) => (v && v.id === updated.id ? updated : v));
      if (body.isVisible !== undefined) {
        toast.success(updated.isVisible ? 'Wish is now shown on the website' : 'Wish hidden from the website');
      } else if (body.isFavourite !== undefined) {
        toast.success(updated.isFavourite ? 'Added to favourites' : 'Removed from favourites');
      }
    },
    onError: (error) => notifyError(error, 'Could not update wish'),
    onSettled: () => setPendingId(null),
  });

  const toggleVisible = (wish: Wish) => update.mutate({ wish, body: { isVisible: !wish.isVisible } });
  const toggleFavourite = (wish: Wish) => update.mutate({ wish, body: { isFavourite: !wish.isFavourite } });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await customerService.deleteWish(deleting.websiteId, deleting.id);
      await invalidate(deleting.websiteId);
      toast.success('Wish deleted');
      setViewing(null);
    } catch (error) {
      notifyError(error, 'Could not delete wish');
      throw error;
    }
  };

  const dialogs = (
    <>
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback>{initials(viewing.senderName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{viewing.senderName}</DialogTitle>
                    <DialogDescription>
                      {formatDateTime(viewing.createdAt, getTimezone?.(viewing.websiteId))}
                      {getWebsiteName?.(viewing.websiteId) ? ` · ${getWebsiteName(viewing.websiteId)}` : ''}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <VisibilityBadge visible={viewing.isVisible} />
                {viewing.isFavourite && <FavouriteBadge />}
              </div>
              <p className="max-h-[50vh] overflow-y-auto rounded-lg bg-muted/40 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                {viewing.message}
              </p>
              {canModerate && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive sm:mr-auto"
                    onClick={() => setDeleting(viewing)}
                  >
                    Delete
                  </Button>
                  <Button variant="outline" onClick={() => toggleFavourite(viewing)} disabled={pendingId === viewing.id}>
                    <Star className={viewing.isFavourite ? 'fill-amber-400 text-amber-500' : ''} />
                    {viewing.isFavourite ? 'Unfavourite' : 'Favourite'}
                  </Button>
                  <Button onClick={() => toggleVisible(viewing)} disabled={pendingId === viewing.id}>
                    {viewing.isVisible ? 'Hide from website' : 'Show on website'}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this wish?"
        description={`The wish from ${deleting?.senderName ?? 'this guest'} will be permanently removed.`}
        confirmLabel="Delete wish"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );

  return {
    open: setViewing,
    toggleVisible: canModerate ? toggleVisible : undefined,
    toggleFavourite: canModerate ? toggleFavourite : undefined,
    remove: canModerate ? setDeleting : undefined,
    pendingId,
    dialogs,
  };
}
