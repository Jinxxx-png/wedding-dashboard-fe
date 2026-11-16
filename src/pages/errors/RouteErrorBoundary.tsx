import { isRouteErrorResponse, useRouteError } from 'react-router';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Last-resort boundary so a render error never leaves a blank screen. */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const isChunkError = error instanceof Error && /Failed to fetch dynamically imported module|Loading chunk/i.test(error.message);
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : isChunkError
      ? 'A new version of the dashboard is available. Reload to continue.'
      : 'An unexpected error occurred while displaying this page.';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center" role="alert">
      <span className="flex size-11 items-center justify-center rounded-xl border bg-card">
        <AlertTriangle className="size-5 text-muted-foreground" />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>
        <RotateCcw /> Reload page
      </Button>
    </div>
  );
}
