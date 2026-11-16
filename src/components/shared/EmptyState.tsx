import type { ComponentType, ReactNode } from 'react';
import { Inbox, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ComponentType<LucideProps>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span className={cn('flex items-center justify-center rounded-xl border bg-card shadow-xs', compact ? 'size-9' : 'size-11')}>
        <Icon className={cn('text-muted-foreground', compact ? 'size-4' : 'size-5')} />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
