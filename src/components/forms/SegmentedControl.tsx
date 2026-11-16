import { cn } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  'aria-label': string;
  size?: 'sm' | 'default';
}

/** Compact single-choice toggle (radio semantics). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'sm',
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn('inline-flex items-center rounded-lg bg-muted p-[3px]', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md px-2.5 font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm',
              selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
