import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLockup } from '@/components/shared/Logo';
import { homePathFor, useAuth } from '@/contexts/AuthContext';

export function NotFoundPage() {
  const { user, mustChangePassword } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-16 items-center px-6">
        <BrandLockup />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-24 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you’re looking for doesn’t exist or you don’t have access to it.
        </p>
        <Button asChild variant="outline">
          <Link to={homePathFor(user, mustChangePassword)}>
            <ArrowLeft /> Back to dashboard
          </Link>
        </Button>
      </main>
    </div>
  );
}
