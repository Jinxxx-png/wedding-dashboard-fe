import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Secondary line under the value (unit, comparison, context). */
  hint?: ReactNode;
  icon?: ComponentType<LucideProps>;
  loading?: boolean;
  className?: string;
  /** Small coloured key that ties the tile to a chart series. */
  swatch?: string;
  testId?: string;
}

export function StatCard({ label, value, hint, icon: Icon, loading, className, swatch, testId }: StatCardProps) {
  return (
    <Card className={cn('gap-0 py-4', className)} data-testid={testId}>
      <div className="flex items-start justify-between gap-2 px-4">
        <div className="flex min-w-0 items-start gap-2">
          {swatch && <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: swatch }} aria-hidden="true" />}
          <p className="text-[13px] leading-snug font-medium text-muted-foreground">{label}</p>
        </div>
        {Icon && (
          <span className="hidden size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground sm:flex">
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <div className="mt-2 px-4">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight sm:text-[28px]" data-slot="stat-value">
            {value}
          </p>
        )}
      </div>
      {hint !== undefined && (
        <div className="mt-1 px-4 text-xs text-muted-foreground">
          {loading ? <Skeleton className="mt-1 h-3 w-32" /> : hint}
        </div>
      )}
    </Card>
  );
}
