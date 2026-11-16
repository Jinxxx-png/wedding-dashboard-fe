import { useState } from 'react';
import { AttendanceKpis, AttendanceSummaryPanel } from './AttendanceKpis';
import {
  AttendanceDistributionCard,
  DietaryCard,
  GuestBreakdownCard,
  MealPreferenceCard,
  RsvpTrendCard,
} from './AnalyticsCharts';
import { useWebsiteAnalytics, useWebsiteTrends } from './useAnalytics';
import { ErrorState } from '@/components/shared/ErrorState';
import type { DateRange } from '@/components/forms/DateRangeFilter';
import type { Granularity, WebsiteView } from '@/types/api';

/** Full analytics block for one website (KPIs, attendance summary, charts). */
export function WebsiteAnalyticsSection({ website, range }: { website: WebsiteView; range: DateRange }) {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const analytics = useWebsiteAnalytics(website.id, range);
  const trends = useWebsiteTrends(website.id, granularity, range);
  const rangeActive = Boolean(range.from || range.to);

  if (analytics.error && !analytics.data) {
    return <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />;
  }

  const a = analytics.data;
  const loading = analytics.isLoading;

  return (
    <div className="space-y-4" aria-busy={analytics.isFetching}>
      <AttendanceKpis summary={a?.summary} declinedPct={a?.attendingVsDeclined.declined.submissionsPercentage} loading={loading} />
      <AttendanceSummaryPanel analytics={a} loading={loading} />
      <div className="grid gap-4 xl:grid-cols-5">
        <RsvpTrendCard
          className="xl:col-span-3"
          points={trends.data?.points}
          granularity={granularity}
          onGranularityChange={setGranularity}
          loading={trends.isLoading}
          error={trends.error}
          onRetry={() => trends.refetch()}
          rangeActive={rangeActive}
        />
        <div className="xl:col-span-2">
          <AttendanceDistributionCard analytics={a} loading={loading} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <GuestBreakdownCard analytics={a} loading={loading} />
        <MealPreferenceCard analytics={a} loading={loading} />
        <DietaryCard analytics={a} loading={loading} />
      </div>
    </div>
  );
}
