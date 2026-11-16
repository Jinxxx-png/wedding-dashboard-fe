import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Baby, Eye, HelpCircle, User, UserCheck, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ExportMenu } from '@/components/shared/ExportMenu';
import { AttendanceBadge, GuestTypeBadge } from '@/components/shared/StatusBadges';
import { DataTablePagination } from '@/components/tables/DataTablePagination';
import { SortableHeader } from '@/components/tables/SortableHeader';
import { ListSkeleton, TableSkeletonRows } from '@/components/tables/TableSkeleton';
import { customerService } from '@/services/customer.service';
import { exportService } from '@/services/export.service';
import { queryKeys } from '@/lib/query';
import { formatNumber, formatPhone, humanize } from '@/utils/format';
import { useWebsiteAnalytics } from '@/features/analytics/useAnalytics';
import { useRsvpFilters } from '@/features/rsvps/useRsvpFilters';
import { useRsvpActions } from '@/features/rsvps/useRsvpActions';
import { RsvpFiltersBar } from '@/features/rsvps/RsvpFiltersBar';
import type { GuestType, Rsvp, WebsiteView } from '@/types/api';

export interface GuestRow {
  key: string;
  name: string;
  type?: GuestType;
  isMain: boolean;
  position: number;
  rsvp: Rsvp;
  /** For RSVPs without guestDetails: number of additional people whose names weren't provided. */
  unnamedCount?: number;
}

/**
 * Individual guests come from each RSVP's `guestDetails` (documented API contract).
 * When an RSVP has no details we show only what the API provides — the main guest
 * plus a count of unnamed additional guests — and never invent names.
 */
export function flattenGuests(rsvps: Rsvp[]): GuestRow[] {
  const rows: GuestRow[] = [];
  for (const rsvp of rsvps) {
    const details = rsvp.guestDetails ?? [];
    if (details.length > 0) {
      details.forEach((g, i) =>
        rows.push({ key: `${rsvp.id}-${i}`, name: g.name, type: g.type, isMain: i === 0, position: i + 1, rsvp }),
      );
    } else {
      rows.push({ key: `${rsvp.id}-0`, name: rsvp.guestName, isMain: true, position: 1, rsvp });
      if (rsvp.numberOfGuests > 1) {
        rows.push({
          key: `${rsvp.id}-unnamed`,
          name: `${rsvp.numberOfGuests - 1} additional guest${rsvp.numberOfGuests - 1 === 1 ? '' : 's'}`,
          isMain: false,
          position: 2,
          rsvp,
          unnamedCount: rsvp.numberOfGuests - 1,
        });
      }
    }
  }
  return rows;
}

export function GuestManager({ website }: { website: WebsiteView }) {
  const filters = useRsvpFilters();
  const actions = useRsvpActions({ getWebsite: (id) => (id === website.id ? website : undefined) });
  const analytics = useWebsiteAnalytics(website.id, filters.range);
  const g = analytics.data?.guestBreakdown;

  const list = useQuery({
    queryKey: queryKeys.website.rsvps(website.id, filters.query),
    queryFn: ({ signal }) => customerService.rsvps(website.id, filters.query, signal),
    placeholderData: keepPreviousData,
  });
  const rows = flattenGuests(list.data?.items ?? []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Attending guests" value={formatNumber(g?.totalAttendingGuests)} icon={UserCheck} loading={analytics.isLoading} hint="All confirmed people" />
        <StatCard label="Adults" value={formatNumber(g?.adults)} icon={User} loading={analytics.isLoading} swatch="var(--chart-1)" />
        <StatCard label="Children" value={formatNumber(g?.children)} icon={Users} loading={analytics.isLoading} swatch="var(--chart-2)" />
        <StatCard label="Infants" value={formatNumber(g?.infants)} icon={Baby} loading={analytics.isLoading} swatch="var(--chart-3)" />
        <StatCard
          label="Type not specified"
          value={formatNumber(g?.unspecified)}
          icon={HelpCircle}
          loading={analytics.isLoading}
          hint="RSVPs without guest details"
          className="col-span-2 md:col-span-1"
        />
      </div>

      <Card className="gap-0 overflow-hidden pb-0">
        <div className="flex flex-col gap-3 px-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Guest list</h2>
              <p className="text-[13px] text-muted-foreground">Individual people from each RSVP. Search matches the RSVP name or phone.</p>
            </div>
            <ExportMenu
              datasets={[{ id: 'guests', label: 'Complete guest list' }]}
              onExport={(_, format) => exportService.websiteRsvps(website.id, website.slug, 'guests', format, filters.exportFilters)}
              filtersActive={filters.filtersActive}
            />
          </div>
          <RsvpFiltersBar filters={filters} timezone={website.timezone} searchPlaceholder="Search RSVP name or phone…" />
        </div>

        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} compact className="border-t" />
        ) : !list.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={Users}
            className="border-t"
            title={filters.filtersActive ? 'No guests match your filters' : 'No guests yet'}
            description={filters.filtersActive ? 'Try adjusting your search or filters.' : 'Guests appear once RSVPs are submitted.'}
          />
        ) : (
          <>
            <div className="hidden border-t md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Guest name</TableHead>
                    <TableHead>Guest type</TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Related RSVP"
                        sortKey="guestName"
                        activeKey={filters.sortBy}
                        order={filters.sortOrder}
                        onSort={filters.toggleSort}
                        disabled={filters.rangeActive}
                        disabledReason="Unavailable while a date range is active"
                      />
                    </TableHead>
                    <TableHead>Phone number</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Meal</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                {list.isLoading ? (
                  <TableSkeletonRows columns={7} />
                ) : (
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.key} className={row.isMain ? '' : 'bg-muted/20'}>
                        <TableCell className="max-w-[220px]">
                          <span className={row.unnamedCount ? 'text-muted-foreground italic' : 'font-medium'}>{row.name}</span>
                          {row.isMain && <span className="ml-2 text-xs text-muted-foreground">Main guest</span>}
                        </TableCell>
                        <TableCell>{row.unnamedCount ? <span className="text-muted-foreground">—</span> : <GuestTypeBadge type={row.type} />}</TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="block truncate">{row.rsvp.guestName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.unnamedCount ? 'Names not provided' : `Guest ${row.position} of ${row.rsvp.numberOfGuests}`}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular">{row.isMain ? formatPhone(row.rsvp.phoneNumber) : '—'}</TableCell>
                        <TableCell>
                          <AttendanceBadge status={row.rsvp.attendanceStatus} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.rsvp.attendanceStatus === 'attending' ? humanize(row.rsvp.mealPreference) : '—'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon-sm" onClick={() => actions.view(row.rsvp)} aria-label={`View RSVP for ${row.rsvp.guestName}`}>
                            <Eye />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                )}
              </Table>
            </div>
            <div className="border-t md:hidden">
              {list.isLoading ? (
                <ListSkeleton />
              ) : (
                <ul className="divide-y">
                  {rows.map((row) => (
                    <li key={row.key}>
                      <button type="button" onClick={() => actions.view(row.rsvp)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={row.unnamedCount ? 'truncate text-muted-foreground italic' : 'truncate font-medium'}>{row.name}</span>
                            {!row.unnamedCount && <GuestTypeBadge type={row.type} />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            RSVP: {row.rsvp.guestName}
                            {row.isMain && row.rsvp.phoneNumber ? ` · ${formatPhone(row.rsvp.phoneNumber)}` : ''}
                          </p>
                          <AttendanceBadge status={row.rsvp.attendanceStatus} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="border-t px-4 sm:px-5">
          <DataTablePagination
            meta={list.data?.meta}
            page={filters.page}
            pageSize={filters.pageSize}
            onPageChange={filters.setPage}
            onPageSizeChange={filters.setPageSize}
            itemLabel="RSVPs"
          />
        </div>
      </Card>
      {actions.dialogs}
    </div>
  );
}
