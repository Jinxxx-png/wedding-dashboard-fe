import { AlertTriangle, Lock, RotateCcw, SearchX, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/services/api';
import { getErrorMessage } from '@/utils/errors';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}

/** Consistent error presentation for queries (403 / 404 / network / server errors). */
export function ErrorState({ error, onRetry, title, className, compact }: ErrorStateProps) {
  let Icon = AlertTriangle;
  let heading = title ?? 'Something went wrong';
  let message = getErrorMessage(error);
  let canRetry = true;

  if (isApiError(error)) {
    if (error.status === 404) {
      Icon = SearchX;
      heading = title ?? 'Not found';
      message = "This item doesn't exist or you don't have access to it.";
      canRetry = false;
    } else if (error.status === 403) {
      Icon = Lock;
      heading = title ?? "You don't have access";
      message = 'Your account does not have permission to view this page.';
      canRetry = false;
    } else if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      Icon = WifiOff;
      heading = title ?? 'Connection problem';
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-4 py-8' : 'rounded-xl border border-dashed bg-card/50 px-6 py-14',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-xl border bg-card">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium">{heading}</p>
        <p className="text-sm whitespace-pre-line text-muted-foreground">{message}</p>
        {isApiError(error) && error.requestId && error.status >= 500 && (
          <p className="font-mono text-[11px] text-muted-foreground">Request ID: {error.requestId}</p>
        )}
      </div>
      {onRetry && canRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw /> Try again
        </Button>
      )}
    </div>
  );
}
