import { Logo } from './Logo';

export function FullScreenLoader({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background" role="status" aria-live="polite">
      <Logo className="size-10 animate-pulse" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
