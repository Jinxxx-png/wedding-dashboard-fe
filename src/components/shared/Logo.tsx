import { cn } from '@/lib/utils';

/** Product mark: two interlocking rings on a near-black tile. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#18181b" />
      <circle cx="12.6" cy="16.5" r="4.6" fill="none" stroke="#fafafa" strokeWidth="1.8" />
      <circle cx="19.4" cy="16.5" r="4.6" fill="none" stroke="#fafafa" strokeWidth="1.8" opacity="0.85" />
    </svg>
  );
}

export function BrandLockup({ subtitle, className }: { subtitle?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Logo />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-tight">Wedding Project</span>
        {subtitle && <span className="truncate text-[11px] text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}
