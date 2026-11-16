import type { ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { AttendanceBadge } from '@/components/shared/StatusBadges';
import { ListSkeleton } from '@/components/tables/TableSkeleton';
import { formatRelative, initials } from '@/utils/format';
import type { Rsvp } from '@/types/api';
import type { WebsiteLabel } from './RsvpTable';

interface RecentRsvpListProps {
  items?: Rsvp[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  action?: ReactNode;
  title?: string;
  websiteLabel?: (websiteId: string) => WebsiteLabel | undefined;
  onSelect?: (rsvp: Rsvp) => void;
}

export function RecentRsvpList({
  items,
  loading,
  error,
  onRetry,
  action,
  title = 'Recent RSVP submissions',
  websiteLabel,
  onSelect,
}: RecentRsvpListProps) {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>Latest responses first</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <div className="border-t">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : !items?.length ? (
          <EmptyState icon={ClipboardList} title="No RSVPs yet" description="New submissions will show up here." compact />
        ) : (
          <ul className="divide-y">
            {items.map((r) => {
              const site = websiteLabel?.(r.websiteId);
              const content = (
                <>
                  <Avatar>
                    <AvatarFallback>{initials(r.guestName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.guestName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.numberOfGuests} guest{r.numberOfGuests === 1 ? '' : 's'}
                      {site ? ` · ${site.name}` : ''} · {formatRelative(r.createdAt)}
                    </p>
                  </div>
                  <AttendanceBadge status={r.attendanceStatus} />
                </>
              );
              return (
                <li key={r.id}>
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(r)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/40"
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
