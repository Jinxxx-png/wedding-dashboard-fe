import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltipCard } from './ChartTooltip';
import { formatNumber } from '@/utils/format';

export interface HorizontalBarDatum {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Optional secondary value shown in the tooltip (e.g. RSVP forms for a guest count). */
  secondary?: { name: string; value: number };
}

interface HorizontalBarChartProps {
  data: HorizontalBarDatum[];
  valueName: string;
  rowHeight?: number;
  labelWidth?: number;
}

/** Category bars (meal preferences, dietary requirements, guest types) with values at the tip. */
export function HorizontalBarChart({ data, valueName, rowHeight = 34, labelWidth = 104 }: HorizontalBarChartProps) {
  const height = Math.max(data.length * rowHeight + 8, 80);
  return (
    <div style={{ height }} role="img" aria-label={`${valueName} by category`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide allowDecimals={false} domain={[0, 'dataMax']} />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(24,24,27,0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as HorizontalBarDatum | undefined;
              if (!d) return null;
              const rows = [{ name: valueName, value: d.value, color: d.color }];
              if (d.secondary) rows.push({ name: d.secondary.name, value: d.secondary.value, color: 'transparent' });
              return <ChartTooltipCard title={d.label} rows={rows} />;
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              formatter={(v: unknown) => formatNumber(Number(v))}
              style={{ fontSize: 12, fill: 'var(--foreground)', fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
