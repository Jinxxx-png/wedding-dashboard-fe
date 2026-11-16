import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InfoItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

/** Read-only key/value list for detail panels. */
export function InfoList({ items, className, columns = 1 }: { items: InfoItem[]; className?: string; columns?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="text-sm break-words">{item.value ?? '—'}</dd>
          {item.hint && <dd className="text-xs text-muted-foreground">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
