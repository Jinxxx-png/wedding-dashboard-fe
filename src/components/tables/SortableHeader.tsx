import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortOrder } from '@/types/api';

interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  activeKey: K;
  order: SortOrder;
  onSort: (key: K) => void;
  disabled?: boolean;
  disabledReason?: string;
  align?: 'left' | 'right';
}

export function SortableHeader<K extends string>({
  label,
  sortKey,
  activeKey,
  order,
  onSort,
  disabled,
  disabledReason,
  align = 'left',
}: SortableHeaderProps<K>) {
  const active = sortKey === activeKey;
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      disabled={disabled}
      title={disabled ? disabledReason : `Sort by ${label.toLowerCase()}`}
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        '-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
        active && 'text-foreground',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {label}
      <Icon className={cn('size-3.5', !active && 'opacity-50')} />
    </button>
  );
}
