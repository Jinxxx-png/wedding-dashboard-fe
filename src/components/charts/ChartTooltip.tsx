import { formatNumber } from '@/utils/format';

export interface TooltipRow {
  name: string;
  value: number;
  color: string;
  suffix?: string;
}

export function ChartTooltipCard({ title, rows, footer }: { title?: string; rows: TooltipRow[]; footer?: string }) {
  return (
    <div className="min-w-[160px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {title && <p className="mb-1.5 font-medium text-foreground">{title}</p>}
      <div className="grid gap-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-[2px]" style={{ background: r.color }} />
              {r.name}
            </span>
            <span className="font-medium text-foreground tabular">
              {formatNumber(r.value)}
              {r.suffix}
            </span>
          </div>
        ))}
      </div>
      {footer && <p className="mt-1.5 border-t pt-1.5 text-muted-foreground">{footer}</p>}
    </div>
  );
}

/** Legend row used under charts — identity comes from the swatch, text stays in ink colours. */
export function ChartLegend({ items }: { items: { name: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden="true" />
          <span>{i.name}</span>
          {i.value && <span className="font-medium text-foreground tabular">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export const CHART_COLORS = {
  attending: 'var(--chart-1)',
  declined: 'var(--chart-2)',
  series3: 'var(--chart-3)',
  series4: 'var(--chart-4)',
  series5: 'var(--chart-5)',
  neutral: 'var(--chart-neutral)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
} as const;
