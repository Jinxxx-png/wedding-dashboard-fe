import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { ChevronsLeft, ChevronsRight, KeyRound, LogOut, Menu, Settings, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrandLockup, Logo } from '@/components/shared/Logo';
import { initials } from '@/utils/format';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  /** Match only the exact path (for index routes). */
  end?: boolean;
}

interface DashboardShellProps {
  nav: NavItem[];
  /** Appended to every nav link (e.g. `?site=<id>` to keep the selected website). */
  linkSearch?: string;
  subtitle: string;
  headerSlot?: ReactNode;
  settingsPath: string;
  passwordPath: string;
  children: ReactNode;
}

const COLLAPSE_KEY = 'wp.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved !== null) return saved === '1';
  } catch {
    /* storage unavailable */
  }
  return typeof window !== 'undefined' && window.innerWidth < 1280;
}

export function DashboardShell({
  nav,
  linkSearch = '',
  subtitle,
  headerSlot,
  settingsPath,
  passwordPath,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop / tablet sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex',
          collapsed ? 'w-[68px]' : 'w-[248px]',
        )}
        aria-label="Primary"
      >
        <div className={cn('flex h-14 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-4')}>
          {collapsed ? <Logo /> : <BrandLockup subtitle={subtitle} />}
        </div>
        <SidebarNav nav={nav} linkSearch={linkSearch} collapsed={collapsed} />
        <div className="mt-auto border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className={cn('w-full text-muted-foreground', collapsed ? 'justify-center px-0' : 'justify-start')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile navigation */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <BrandLockup subtitle={subtitle} />
          </div>
          <SidebarNav nav={nav} linkSearch={linkSearch} collapsed={false} />
        </SheetContent>
      </Sheet>

      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', collapsed ? 'md:pl-[68px]' : 'md:pl-[248px]')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <Link to={nav[0]?.to ?? '/'} className="md:hidden" aria-label="Home">
            <Logo className="size-6" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">{headerSlot}</div>
          <UserMenu settingsPath={settingsPath + linkSearch} passwordPath={passwordPath + linkSearch} />
        </header>
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ nav, linkSearch, collapsed }: { nav: NavItem[]; linkSearch: string; collapsed: boolean }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {nav.map((item) => {
        const link = (
          <NavLink
            key={item.to}
            to={item.to + linkSearch}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--border)]',
                collapsed && 'justify-center px-0',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('size-4 shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')} />
                <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
              </>
            )}
          </NavLink>
        );
        if (!collapsed) return link;
        return (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function UserMenu({ settingsPath, passwordPath }: { settingsPath: string; passwordPath: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const name = user.settings.displayName || user.username;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="truncate font-normal">
            @{user.username} · {user.role === 'admin' ? 'Administrator' : 'Customer'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(settingsPath)}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(passwordPath)}>
          <KeyRound /> Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
