import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltipCard, CHART_COLORS } from './ChartTooltip';
import { formatNumber, formatPercent } from '@/utils/format';
import type { AttendanceSplitItem } from '@/types/api';

export type SplitMode = 'submissions' | 'guests';

interface AttendanceDonutProps {
  attending: AttendanceSplitItem;
  declined: AttendanceSplitItem;
  mode: SplitMode;
  height?: number;
}

export function AttendanceDonut({ attending, declined, mode, height = 200 }: AttendanceDonutProps) {
  const isForms = mode === 'submissions';
  const data = [
    {
      name: 'Attending',
      value: isForms ? attending.submissions : attending.guests,
      pct: isForms ? attending.submissionsPercentage : attending.guestsPercentage,
      color: CHART_COLORS.attending,
    },
    {
      name: 'Not attending',
      value: isForms ? declined.submissions : declined.guests,
      pct: isForms ? declined.submissionsPercentage : declined.guestsPercentage,
      color: CHART_COLORS.declined,
    },
  ];
  const total = data[0]!.value + data[1]!.value;
  const unit = isForms ? 'RSVP forms' : 'guests';

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,200px)_1fr]">
      <div className="relative mx-auto w-full max-w-[200px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={total > 0 && data.every((d) => d.value > 0) ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as (typeof data)[number] | undefined;
                if (!d) return null;
                return (
                  <ChartTooltipCard
                    rows={[{ name: d.name, value: d.value, color: d.color }]}
                    footer={`${formatPercent(d.pct)} of ${unit}`}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight">{formatNumber(total)}</span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <ul className="grid gap-2.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-[3px]" style={{ background: d.color }} aria-hidden="true" />
              {d.name}
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold tabular">{formatNumber(d.value)}</span>
              <span className="block text-xs text-muted-foreground tabular">{formatPercent(d.pct)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
