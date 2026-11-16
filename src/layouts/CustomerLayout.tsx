import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { ClipboardList, Globe2, LayoutDashboard, MessageSquareHeart, Settings, Users } from 'lucide-react';
import { DashboardShell, type NavItem } from './DashboardShell';
import { WebsiteProvider, useWebsites } from '@/contexts/WebsiteContext';
import { WebsiteSelector } from '@/components/shared/WebsiteSelector';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageSkeleton } from '@/components/shared/PageSkeleton';

export const CUSTOMER_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/rsvps', label: 'RSVP Management', icon: ClipboardList },
  { to: '/dashboard/wishes', label: 'Wedding Wishes', icon: MessageSquareHeart },
  { to: '/dashboard/guests', label: 'Guest Management', icon: Users },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function CustomerLayout() {
  return (
    <WebsiteProvider>
      <CustomerShell />
    </WebsiteProvider>
  );
}

function CustomerShell() {
  const { websites, website, setWebsiteId, isLoading, error, refetch, linkSearch } = useWebsites();

  let content: ReactNode;
  if (isLoading) content = <PageSkeleton />;
  else if (error) content = <ErrorState error={error} onRetry={refetch} />;
  else if (!website)
    content = (
      <EmptyState
        icon={Globe2}
        title="No wedding website assigned yet"
        description="Your account doesn't have a wedding website yet. Contact your administrator to have one assigned."
        className="mt-10"
      />
    );
  // Remount pages when the website changes so filters and pagination reset cleanly.
  else content = <Outlet key={website.id} />;

  return (
    <DashboardShell
      nav={CUSTOMER_NAV}
      linkSearch={linkSearch}
      subtitle="Customer dashboard"
      settingsPath="/dashboard/settings"
      passwordPath="/dashboard/change-password"
      headerSlot={
        <WebsiteSelector websites={websites} value={website} onChange={setWebsiteId} loading={isLoading} />
      }
    >
      {content}
    </DashboardShell>
  );
}
