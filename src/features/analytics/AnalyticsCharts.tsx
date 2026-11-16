import { useState } from 'react';
import { ChartCard } from '@/components/charts/ChartCard';
import { TrendChart, trendHasData, type TrendMetric } from '@/components/charts/TrendChart';
import { AttendanceDonut, type SplitMode } from '@/components/charts/AttendanceDonut';
import { HorizontalBarChart, type HorizontalBarDatum } from '@/components/charts/HorizontalBarChart';
import { CHART_COLORS } from '@/components/charts/ChartTooltip';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { formatNumber, humanize } from '@/utils/format';
import type { Analytics, BreakdownItem, Granularity, TrendPoint } from '@/types/api';

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

const GRANULARITY_HINT: Record<Granularity, string> = {
  day: 'last 30 days',
  week: 'last 12 weeks',
  month: 'last 12 months',
};

interface TrendCardProps {
  points?: TrendPoint[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  rangeActive?: boolean;
  title?: string;
  className?: string;
}

export function RsvpTrendCard({
  points,
  granularity,
  onGranularityChange,
  loading,
  error,
  onRetry,
  rangeActive,
  title = 'RSVP submission trend',
  className,
}: TrendCardProps) {
  const [metric, setMetric] = useState<TrendMetric>('forms');
  return (
    <ChartCard
      className={className}
      title={title}
      description={rangeActive ? 'Within the selected date range' : `Submissions over the ${GRANULARITY_HINT[granularity]}`}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!trendHasData(points)}
      emptyTitle="No RSVP submissions in this period"
      height={280}
      action={
        <div className="flex flex-wrap justify-end gap-2">
          <SegmentedControl
            aria-label="Trend metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'forms', label: 'RSVP forms' },
              { value: 'guests', label: 'Guests' },
            ]}
          />
          <SegmentedControl
            aria-label="Trend granularity"
            value={granularity}
            onChange={onGranularityChange}
            options={GRANULARITY_OPTIONS}
          />
        </div>
      }
    >
      <TrendChart points={points ?? []} granularity={granularity} metric={metric} height={250} />
    </ChartCard>
  );
}

export function AttendanceDistributionCard({ analytics, loading, error }: { analytics?: Analytics; loading?: boolean; error?: unknown }) {
  const [mode, setMode] = useState<SplitMode>('submissions');
  const split = analytics?.attendingVsDeclined;
  const empty = !split || split.attending.submissions + split.declined.submissions === 0;
  return (
    <ChartCard
      title="Attendance distribution"
      description="Attending vs not attending"
      loading={loading}
      error={error}
      empty={empty}
      height={200}
      action={
        <SegmentedControl
          aria-label="Count by"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'submissions', label: 'Forms' },
            { value: 'guests', label: 'Guests' },
          ]}
        />
      }
    >
      {split && <AttendanceDonut attending={split.attending} declined={split.declined} mode={mode} />}
    </ChartCard>
  );
}

export function GuestBreakdownCard({ analytics, loading, error }: { analytics?: Analytics; loading?: boolean; error?: unknown }) {
  const g = analytics?.guestBreakdown;
  const data: HorizontalBarDatum[] = g
    ? [
        { key: 'adults', label: 'Adults', value: g.adults, color: CHART_COLORS.attending },
        { key: 'children', label: 'Children', value: g.children, color: CHART_COLORS.declined },
        { key: 'infants', label: 'Infants', value: g.infants, color: CHART_COLORS.series3 },
        { key: 'unspecified', label: 'Unspecified', value: g.unspecified, color: CHART_COLORS.neutral },
      ]
    : [];
  return (
    <ChartCard
      title="Guest count distribution"
      description={g ? `${formatNumber(g.totalAttendingGuests)} attending guests by type` : 'Attending guests by type'}
      loading={loading}
      error={error}
      empty={!g || g.totalAttendingGuests === 0}
      emptyTitle="No attending guests yet"
      height={150}
    >
      <HorizontalBarChart data={data} valueName="Guests" labelWidth={90} />
    </ChartCard>
  );
}

function toBars(items: BreakdownItem[] | undefined, metric: 'guests' | 'submissions', neutralKeys: string[]): HorizontalBarDatum[] {
  return [...(items ?? [])]
    .filter((i) => i[metric] > 0)
    .sort((a, b) => {
      // Neutral buckets (unspecified / none) always sit at the bottom.
      const an = neutralKeys.includes(a.key) ? 1 : 0;
      const bn = neutralKeys.includes(b.key) ? 1 : 0;
      return an - bn || b[metric] - a[metric];
    })
    .map((i) => ({
      key: i.key,
      label: humanize(i.key),
      value: i[metric],
      color: neutralKeys.includes(i.key) ? CHART_COLORS.neutral : CHART_COLORS.attending,
      secondary:
        metric === 'guests'
          ? { name: 'RSVP forms', value: i.submissions }
          : { name: 'Guests', value: i.guests },
    }));
}

export function MealPreferenceCard({ analytics, loading, error }: { analytics?: Analytics; loading?: boolean; error?: unknown }) {
  const data = toBars(analytics?.mealPreferences, 'guests', ['unspecified']);
  return (
    <ChartCard
      title="Meal preferences"
      description="Attending guests per meal option (catering counts)"
      loading={loading}
      error={error}
      empty={data.length === 0}
      emptyTitle="No meal preferences recorded"
      emptyDescription="Meal choices appear once attending guests select one."
      height={160}
    >
      <HorizontalBarChart data={data} valueName="Guests" />
    </ChartCard>
  );
}

export function DietaryCard({ analytics, loading, error }: { analytics?: Analytics; loading?: boolean; error?: unknown }) {
  const data = toBars(analytics?.dietaryRequirements, 'submissions', ['none', 'other']);
  return (
    <ChartCard
      title="Dietary requirements"
      description="RSVP forms per detected category (one RSVP can be in several)"
      loading={loading}
      error={error}
      empty={data.length === 0}
      emptyTitle="No dietary requirements recorded"
      height={160}
    >
      <HorizontalBarChart data={data} valueName="RSVP forms" labelWidth={120} />
    </ChartCard>
  );
}
