import { CheckCircle2, ClipboardList, Heart, Info, UserCheck, XCircle } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatNumber, formatPercent } from '@/utils/format';
import type { Analytics, AttendanceSummary } from '@/types/api';

interface KpiProps {
  summary?: AttendanceSummary;
  declinedPct?: number;
  loading?: boolean;
}

/**
 * Top KPI row. RSVP *forms* and *guests* are always labelled separately — one RSVP form
 * can bring several guests. All values come straight from the backend analytics API.
 */
export function AttendanceKpis({ summary, declinedPct, loading }: KpiProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        testId="kpi-total-submissions"
        label="RSVP forms received"
        value={formatNumber(summary?.totalSubmissions)}
        hint="Total RSVP submissions"
        icon={ClipboardList}
        loading={loading}
      />
      <StatCard
        testId="kpi-attending-submissions"
        label="Attending forms"
        value={formatNumber(summary?.attendingSubmissions)}
        hint={summary ? `${formatPercent(summary.attendancePercentage)} of RSVP forms` : undefined}
        icon={CheckCircle2}
        loading={loading}
        swatch="var(--chart-1)"
      />
      <StatCard
        testId="kpi-declined-submissions"
        label="Declined forms"
        value={formatNumber(summary?.declinedSubmissions)}
        hint={declinedPct !== undefined ? `${formatPercent(declinedPct)} of RSVP forms` : undefined}
        icon={XCircle}
        loading={loading}
        swatch="var(--chart-2)"
      />
      <StatCard
        testId="kpi-attending-guests"
        label="Guests attending"
        value={formatNumber(summary?.attendingGuests)}
        hint={
          summary ? `People, avg ${summary.averageGuestsPerAttendingRsvp.toFixed(1)} per attending RSVP` : undefined
        }
        icon={UserCheck}
        loading={loading}
      />
      <StatCard
        testId="kpi-total-wishes"
        label="Wedding wishes"
        value={formatNumber(summary?.totalWishes)}
        hint="Messages from guests"
        icon={Heart}
        loading={loading}
        className="col-span-2 md:col-span-1"
      />
    </div>
  );
}

export function AttendanceSummaryPanel({ analytics, loading }: { analytics?: Analytics; loading?: boolean }) {
  const s = analytics?.summary;
  const items = [
    { label: 'Expected attendees', value: formatNumber(s?.expectedAttendees), hint: 'Headcount for planning' },
    {
      label: 'Confirmed attending guests',
      value: formatNumber(s?.attendingGuests),
      hint: s ? `From ${formatNumber(s.attendingSubmissions)} attending RSVP forms` : '',
    },
    {
      label: 'Declined guests',
      value: formatNumber(s?.declinedGuests),
      hint: s ? `From ${formatNumber(s.declinedSubmissions)} declined RSVP forms` : '',
    },
  ];

  return (
    <Card className="gap-0 overflow-hidden py-0" data-testid="attendance-summary">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold">Attendance summary</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground" aria-label="About attendance figures">
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              RSVP forms and guests are counted separately — one RSVP form can include several guests.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-card px-5 py-4">
            <p className="text-[13px] font-medium text-muted-foreground">{item.label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-20" />
            ) : (
              <p className="mt-1.5 text-2xl font-semibold tracking-tight">{item.value}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">{loading ? " " : item.hint}</p>
          </div>
        ))}
        <div className="bg-card px-5 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Attendance rate</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{formatPercent(s?.attendancePercentage)}</p>
          )}
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
            role="meter"
            aria-label="Attendance rate by RSVP forms"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={s?.attendancePercentage ?? 0}
          >
            <div
              className="h-full rounded-full bg-[var(--chart-1)] transition-[width]"
              style={{ width: `${Math.min(s?.attendancePercentage ?? 0, 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {loading ? " " : `By forms · ${formatPercent(s?.guestAttendancePercentage)} by guests`}
          </p>
        </div>
      </div>
    </Card>
  );
}
