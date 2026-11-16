import { MessageSquareHeart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { WishCard } from './WishCard';
import type { useWishActions } from './useWishActions';
import type { Wish } from '@/types/api';

interface WishGridProps {
  items: Wish[];
  loading?: boolean;
  actions: ReturnType<typeof useWishActions>;
  timezone?: (websiteId: string) => string | undefined;
  websiteLabel?: (websiteId: string) => string | undefined;
  emptyTitle: string;
  emptyDescription: string;
}

export function WishGrid({ items, loading, actions, timezone, websiteLabel, emptyTitle, emptyDescription }: WishGridProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50">
        <EmptyState icon={MessageSquareHeart} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((w) => (
        <WishCard
          key={w.id}
          wish={w}
          timezone={timezone?.(w.websiteId)}
          websiteLabel={websiteLabel?.(w.websiteId)}
          onOpen={actions.open}
          onToggleVisible={actions.toggleVisible}
          onToggleFavourite={actions.toggleFavourite}
          onDelete={actions.remove}
          pending={actions.pendingId === w.id}
        />
      ))}
    </div>
  );
}
