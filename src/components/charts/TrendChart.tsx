import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartLegend, ChartTooltipCard, CHART_COLORS } from './ChartTooltip';
import { formatCalendarDate, formatPeriod } from '@/utils/format';
import type { Granularity, TrendPoint } from '@/types/api';

export type TrendMetric = 'forms' | 'guests';

interface TrendChartProps {
  points: TrendPoint[];
  granularity: Granularity;
  metric: TrendMetric;
  height?: number;
}

interface Row {
  label: string;
  period: string;
  startDate: string;
  endDate: string;
  attending: number;
  declined: number;
}

/**
 * RSVP trend as stacked columns: attending + declined per period. One y-axis only —
 * "forms" (RSVP submissions) and "guests" (people) are separate views, never mixed.
 */
export function TrendChart({ points, granularity, metric, height = 260 }: TrendChartProps) {
  const rows: Row[] = points.map((p) => ({
    label: formatPeriod(p.period, granularity),
    period: p.period,
    startDate: p.startDate,
    endDate: p.endDate,
    attending: metric === 'forms' ? p.attending : p.attendingGuests,
    declined: metric === 'forms' ? p.declined : p.declinedGuests,
  }));
  const unit = metric === 'forms' ? 'forms' : 'guests';

  return (
    <div className="grid gap-3">
      <ChartLegend
        items={[
          { name: metric === 'forms' ? 'Attending RSVPs' : 'Attending guests', color: CHART_COLORS.attending },
          { name: metric === 'forms' ? 'Declined RSVPs' : 'Declined guests', color: CHART_COLORS.declined },
        ]}
      />
      <div style={{ height }} className="-ml-2" role="img" aria-label={`RSVP ${unit} trend by ${granularity}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={14}
              tickMargin={8}
              interval="preserveStartEnd"
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tickMargin={4} />
            <Tooltip
              cursor={{ fill: 'rgba(24,24,27,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as Row | undefined;
                if (!row) return null;
                const title =
                  granularity === 'day'
                    ? formatCalendarDate(row.startDate, true)
                    : `${formatCalendarDate(row.startDate)} – ${formatCalendarDate(row.endDate)}`;
                return (
                  <ChartTooltipCard
                    title={title}
                    rows={[
                      { name: 'Attending', value: row.attending, color: CHART_COLORS.attending },
                      { name: 'Declined', value: row.declined, color: CHART_COLORS.declined },
                    ]}
                    footer={`${row.attending + row.declined} ${unit} total`}
                  />
                );
              }}
            />
            <Bar
              dataKey="attending"
              stackId="rsvp"
              fill={CHART_COLORS.attending}
              maxBarSize={24}
              stroke="var(--card)"
              strokeWidth={1}
              isAnimationActive={false}
            />
            <Bar
              dataKey="declined"
              stackId="rsvp"
              fill={CHART_COLORS.declined}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              stroke="var(--card)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function trendHasData(points: TrendPoint[] | undefined): boolean {
  return Boolean(points?.some((p) => p.submissions > 0 || p.attendingGuests > 0 || p.declinedGuests > 0));
}
