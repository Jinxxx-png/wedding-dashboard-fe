import type { ReactNode } from 'react';
import { MessageSquareHeart, Star } from 'lucide-react';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/tables/TableSkeleton';
import { formatRelative, initials } from '@/utils/format';
import type { Wish } from '@/types/api';

interface RecentWishListProps {
  items?: Wish[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  action?: ReactNode;
  title?: string;
  websiteLabel?: (websiteId: string) => string | undefined;
}

export function RecentWishList({ items, loading, error, onRetry, action, title = 'Recent wedding wishes', websiteLabel }: RecentWishListProps) {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>Newest messages from guests</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <div className="border-t">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : !items?.length ? (
          <EmptyState icon={MessageSquareHeart} title="No wishes yet" description="Guest messages will show up here." compact />
        ) : (
          <ul className="divide-y">
            {items.map((w) => (
              <li key={w.id} className="flex gap-3 px-5 py-3">
                <Avatar>
                  <AvatarFallback>{initials(w.senderName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{w.senderName}</p>
                    {w.isFavourite && <Star className="size-3 shrink-0 fill-amber-400 text-amber-500" aria-label="Favourite" />}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelative(w.createdAt)}</span>
                  </div>
                  {websiteLabel?.(w.websiteId) && (
                    <p className="truncate text-xs text-muted-foreground">{websiteLabel(w.websiteId)}</p>
                  )}
                  <p className="mt-0.5 line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">{w.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
