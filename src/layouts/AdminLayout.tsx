import { Outlet } from 'react-router';
import {
  ClipboardList,
  Globe,
  LayoutDashboard,
  MessageSquareHeart,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { DashboardShell, type NavItem } from './DashboardShell';

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/websites', label: 'Websites', icon: Globe },
  { to: '/admin/rsvps', label: 'All RSVPs', icon: ClipboardList },
  { to: '/admin/wishes', label: 'All Wishes', icon: MessageSquareHeart },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout() {
  return (
    <DashboardShell
      nav={ADMIN_NAV}
      subtitle="Admin console"
      settingsPath="/admin/settings"
      passwordPath="/admin/settings"
      headerSlot={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" />
          <span className="hidden sm:inline">Platform administration</span>
        </div>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
