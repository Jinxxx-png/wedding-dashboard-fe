import { useEffect, useState } from 'react';
import { CalendarDays, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { daysAgo, formatCalendarDate, toISODate } from '@/utils/format';

export interface DateRange {
  from?: string;
  to?: string;
}

interface Preset {
  id: string;
  label: string;
  range: () => DateRange;
}

const PRESETS: Preset[] = [
  { id: 'all', label: 'All time', range: () => ({}) },
  { id: '7d', label: 'Last 7 days', range: () => ({ from: daysAgo(6), to: toISODate(new Date()) }) },
  { id: '30d', label: 'Last 30 days', range: () => ({ from: daysAgo(29), to: toISODate(new Date()) }) },
  { id: '90d', label: 'Last 90 days', range: () => ({ from: daysAgo(89), to: toISODate(new Date()) }) },
  {
    id: 'mtd',
    label: 'Month to date',
    range: () => {
      const now = new Date();
      return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISODate(now) };
    },
  },
];

function rangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return 'All time';
  const match = PRESETS.find((p) => {
    const r = p.range();
    return r.from === range.from && r.to === range.to;
  });
  if (match) return match.label;
  if (range.from && range.to) return `${formatCalendarDate(range.from)} – ${formatCalendarDate(range.to)}`;
  if (range.from) return `From ${formatCalendarDate(range.from)}`;
  return `Until ${formatCalendarDate(range.to)}`;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  /** Dates are interpreted in the website's timezone by the backend. */
  timezoneNote?: string;
}

/** Preset list + custom range. Emits `YYYY-MM-DD` strings (backend `from` / `to`). */
export function DateRangeFilter({ value, onChange, className, timezoneNote }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const active = Boolean(value.from || value.to);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const invalid = Boolean(draft.from && draft.to && draft.from > draft.to);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('justify-start', active && 'border-zinc-300 bg-accent/60', className)}>
          <CalendarDays className="text-muted-foreground" />
          <span className="truncate">{rangeLabel(value)}</span>
          {active && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date range"
              className="-mr-1 ml-1 flex size-5 items-center justify-center rounded hover:bg-zinc-200"
              onClick={(e) => {
                e.stopPropagation();
                onChange({});
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({});
                }
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="p-1">
          {PRESETS.map((p) => {
            const r = p.range();
            const selected = r.from === value.from && r.to === value.to;
            return (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                }}
              >
                {p.label}
                {selected && <Check className="size-4" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
        <Separator />
        <form
          className="grid gap-3 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            onChange({ from: draft.from || undefined, to: draft.to || undefined });
            setOpen(false);
          }}
        >
          <p className="text-xs font-medium text-muted-foreground">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="range-from" className="text-xs">From</Label>
              <Input
                id="range-from"
                type="date"
                value={draft.from ?? ''}
                max={draft.to || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value || undefined }))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="range-to" className="text-xs">To</Label>
              <Input
                id="range-to"
                type="date"
                value={draft.to ?? ''}
                min={draft.from || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value || undefined }))}
              />
            </div>
          </div>
          {invalid && <p className="text-xs text-destructive">“From” must be before “To”.</p>}
          {timezoneNote && <p className="text-[11px] text-muted-foreground">{timezoneNote}</p>}
          <Button type="submit" size="sm" disabled={invalid || (!draft.from && !draft.to)}>
            Apply range
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
