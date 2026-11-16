import { Eye, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AttendanceBadge } from '@/components/shared/StatusBadges';
import { EmptyState } from '@/components/shared/EmptyState';
import { SortableHeader } from '@/components/tables/SortableHeader';
import { TableSkeletonRows, ListSkeleton } from '@/components/tables/TableSkeleton';
import { formatDateTime, formatPhone, humanize } from '@/utils/format';
import type { Rsvp, RsvpSortBy, SortOrder } from '@/types/api';

export interface WebsiteLabel {
  name: string;
  slug: string;
  timezone?: string;
}

interface RsvpTableProps {
  items: Rsvp[];
  loading?: boolean;
  sortBy: RsvpSortBy;
  sortOrder: SortOrder;
  onSort: (key: RsvpSortBy) => void;
  sortLocked?: boolean;
  /** Timezone used for timestamps (website timezone). */
  timezone?: string;
  /** Admin views: resolves website name + slug for every row. */
  websiteLabel?: (websiteId: string) => WebsiteLabel | undefined;
  onView: (rsvp: Rsvp) => void;
  onEdit?: (rsvp: Rsvp) => void;
  onDelete?: (rsvp: Rsvp) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function RsvpTable({
  items,
  loading,
  sortBy,
  sortOrder,
  onSort,
  sortLocked,
  timezone,
  websiteLabel,
  onView,
  onEdit,
  onDelete,
  emptyTitle = 'No RSVPs found',
  emptyDescription = 'Try adjusting your search or filters.',
}: RsvpTableProps) {
  const showWebsite = Boolean(websiteLabel);
  const columns = showWebsite ? 8 : 7;
  const lockReason = 'Sorting by this column is unavailable while a date range is active';

  const actions = (rsvp: Rsvp) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${rsvp.guestName}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onView(rsvp)}>
          <Eye /> View details
        </DropdownMenuItem>
        {onEdit && (
          <DropdownMenuItem onSelect={() => onEdit(rsvp)}>
            <Pencil /> Edit RSVP
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(rsvp)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!loading && items.length === 0) {
    return <EmptyState icon={Users} title={emptyTitle} description={emptyDescription} className="border-t" />;
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden border-t md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <SortableHeader
                  label="Guest name"
                  sortKey="guestName"
                  activeKey={sortBy}
                  order={sortOrder}
                  onSort={onSort}
                  disabled={sortLocked}
                  disabledReason={lockReason}
                />
              </TableHead>
              {showWebsite && <TableHead>Website</TableHead>}
              <TableHead>Phone number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Guests"
                  sortKey="numberOfGuests"
                  activeKey={sortBy}
                  order={sortOrder}
                  onSort={onSort}
                  disabled={sortLocked}
                  disabledReason={lockReason}
                  align="right"
                />
              </TableHead>
              <TableHead>Meal</TableHead>
              <TableHead>
                <SortableHeader label="Submitted" sortKey="createdAt" activeKey={sortBy} order={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          {loading ? (
            <TableSkeletonRows columns={columns} />
          ) : (
            <TableBody>
              {items.map((rsvp) => {
                const site = websiteLabel?.(rsvp.websiteId);
                return (
                  <TableRow key={rsvp.id} className="cursor-pointer" onClick={() => onView(rsvp)}>
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate font-medium">{rsvp.guestName}</span>
                    </TableCell>
                    {showWebsite && (
                      <TableCell className="max-w-[200px]">
                        <span className="block truncate">{site?.name ?? 'Unknown website'}</span>
                        <span className="block truncate text-xs text-muted-foreground">/{site?.slug ?? rsvp.websiteId}</span>
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground tabular">{formatPhone(rsvp.phoneNumber)}</TableCell>
                    <TableCell>
                      <AttendanceBadge status={rsvp.attendanceStatus} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular">{rsvp.numberOfGuests}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {rsvp.attendanceStatus === 'attending' ? humanize(rsvp.mealPreference) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular">
                      {formatDateTime(rsvp.createdAt, site?.timezone ?? timezone)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>{actions(rsvp)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          )}
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="border-t md:hidden">
        {loading ? (
          <ListSkeleton />
        ) : (
          <ul className="divide-y">
            {items.map((rsvp) => {
              const site = websiteLabel?.(rsvp.websiteId);
              return (
                <li key={rsvp.id} className="flex items-start gap-3 px-4 py-3.5">
                  <button type="button" className="min-w-0 flex-1 space-y-1.5 text-left" onClick={() => onView(rsvp)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{rsvp.guestName}</span>
                      <AttendanceBadge status={rsvp.attendanceStatus} />
                    </div>
                    {site && <p className="truncate text-xs text-muted-foreground">{site.name} · /{site.slug}</p>}
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{formatPhone(rsvp.phoneNumber)}</span>
                      <span>
                        {rsvp.numberOfGuests} guest{rsvp.numberOfGuests === 1 ? '' : 's'}
                      </span>
                      {rsvp.attendanceStatus === 'attending' && rsvp.mealPreference && <span>{humanize(rsvp.mealPreference)}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(rsvp.createdAt, site?.timezone ?? timezone)}</p>
                  </button>
                  {actions(rsvp)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
