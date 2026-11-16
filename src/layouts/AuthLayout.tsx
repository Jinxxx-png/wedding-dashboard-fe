import { Outlet } from 'react-router';
import { BrandLockup } from '@/components/shared/Logo';

/** Clean, centred layout for sign-in and password setup. */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(24,24,27,0.05),transparent)]"
      />
      <header className="relative flex h-16 items-center px-6">
        <BrandLockup />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[400px]">
          <Outlet />
        </div>
      </main>
      <footer className="relative px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Wedding Project · Accounts are created by your administrator.
      </footer>
    </div>
  );
}
