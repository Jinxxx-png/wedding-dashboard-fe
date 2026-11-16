import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  height?: number;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Frame for every chart: title, optional controls, loading skeleton, empty and error states. */
export function ChartCard({
  title,
  description,
  action,
  loading,
  error,
  onRetry,
  empty,
  emptyTitle = 'No data yet',
  emptyDescription = 'Data will appear here once guests start responding.',
  height = 260,
  className,
  children,
  footer,
}: ChartCardProps) {
  let body: ReactNode;
  if (loading) body = <Skeleton className="w-full rounded-lg" style={{ height }} />;
  else if (error) body = <ErrorState error={error} onRetry={onRetry} compact />;
  else if (empty)
    body = (
      <div style={{ minHeight: height }} className="flex items-center justify-center">
        <EmptyState icon={BarChart3} title={emptyTitle} description={emptyDescription} compact />
      </div>
    );
  else body = children;

  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="min-w-0 flex-1">{body}</CardContent>
      {footer && !loading && !error && !empty && <div className="px-5">{footer}</div>}
    </Card>
  );
}
