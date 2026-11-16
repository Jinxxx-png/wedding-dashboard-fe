import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarHeart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ExportMenu } from '@/components/shared/ExportMenu';
import { DateRangeFilter, type DateRange } from '@/components/forms/DateRangeFilter';
import { useWebsites, useSelectedWebsite } from '@/contexts/WebsiteContext';
import { WebsiteAnalyticsSection } from '@/features/analytics/WebsiteAnalyticsSection';
import { RecentRsvpList } from '@/features/rsvps/RecentRsvpList';
import { RecentWishList } from '@/features/wishes/RecentWishList';
import { useRsvpActions } from '@/features/rsvps/useRsvpActions';
import { customerService } from '@/services/customer.service';
import { exportService } from '@/services/export.service';
import { queryKeys } from '@/lib/query';
import { formatCalendarDate, formatNumber, weddingCountdown, daysUntil } from '@/utils/format';

export function OverviewPage() {
  const website = useSelectedWebsite();
  const { websites, linkSearch } = useWebsites();
  const [range, setRange] = useState<DateRange>({});
  const actions = useRsvpActions({ getWebsite: () => website });

  const dashboard = useQuery({ queryKey: queryKeys.customer.dashboard, queryFn: customerService.dashboard });
  const siteSummary = dashboard.data?.websites.find((w) => w.website.id === website.id);
  const days = siteSummary?.daysUntilWedding ?? daysUntil(website.weddingDate);
  const countdown = weddingCountdown(days);

  const recentQuery = { page: 1, pageSize: 5, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };
  const recentRsvps = useQuery({
    queryKey: queryKeys.website.rsvps(website.id, recentQuery),
    queryFn: () => customerService.rsvps(website.id, recentQuery),
  });
  const recentWishQuery = { page: 1, pageSize: 4, sortOrder: 'desc' as const };
  const recentWishes = useQuery({
    queryKey: queryKeys.website.wishes(website.id, recentWishQuery),
    queryFn: () => customerService.wishes(website.id, recentWishQuery),
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {website.weddingDate && (
              <span className="flex items-center gap-1.5">
                <CalendarHeart className="size-3.5" /> {formatCalendarDate(website.weddingDate, true)}
              </span>
            )}
            {countdown && <Badge variant="outline">{countdown}</Badge>}
            {!website.isActive && <Badge variant="warning">Website inactive</Badge>}
          </span>
        }
        title={website.websiteName}
        description={
          <a href={website.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-foreground">
            {website.websiteUrl.replace(/^https?:\/\//, '')} <ExternalLink className="size-3" />
          </a>
        }
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} timezoneNote={`Dates are interpreted in ${website.timezone}.`} />
            <ExportMenu
              label="Export report"
              datasets={[
                { id: 'attendance', label: 'Attendance summary', description: 'XLSX: summary, RSVPs, guests, wishes' },
                { id: 'rsvp', label: 'All RSVP submissions' },
                { id: 'guests', label: 'Complete guest list' },
                { id: 'wishes', label: 'Wedding wishes' },
              ]}
              filtersActive={Boolean(range.from || range.to)}
              onExport={(id, format) => {
                if (id === 'attendance') return exportService.websiteAttendance(website.id, website.slug, format, range);
                if (id === 'wishes') return exportService.websiteWishes(website.id, website.slug, format, range);
                return exportService.websiteRsvps(website.id, website.slug, id === 'guests' ? 'guests' : 'rsvp', format, range);
              }}
            />
          </>
        }
      />

      {websites.length > 1 && dashboard.data && (
        <Card className="mb-4 flex-row flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 text-sm">
          <span className="font-medium">Across all {websites.length} websites</span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{formatNumber(dashboard.data.totals.totalSubmissions)}</span> RSVP forms
          </span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{formatNumber(dashboard.data.totals.attendingGuests)}</span> guests attending
          </span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{formatNumber(dashboard.data.totals.totalWishes)}</span> wishes
          </span>
        </Card>
      )}

      <WebsiteAnalyticsSection website={website} range={range} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <RecentRsvpList
          items={recentRsvps.data?.items}
          loading={recentRsvps.isLoading}
          error={recentRsvps.error}
          onRetry={() => recentRsvps.refetch()}
          onSelect={actions.view}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/dashboard/rsvps${linkSearch}`}>
                View all <ArrowRight />
              </Link>
            </Button>
          }
        />
        <RecentWishList
          items={recentWishes.data?.items}
          loading={recentWishes.isLoading}
          error={recentWishes.error}
          onRetry={() => recentWishes.refetch()}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/dashboard/wishes${linkSearch}`}>
                View all <ArrowRight />
              </Link>
            </Button>
          }
        />
      </div>
      {actions.dialogs}
    </>
  );
}
