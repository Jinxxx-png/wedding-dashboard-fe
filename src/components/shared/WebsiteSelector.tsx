import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { WebsiteView } from '@/types/api';

interface WebsiteSelectorProps {
  websites: WebsiteView[];
  value: WebsiteView | null;
  onChange: (id: string) => void;
  loading?: boolean;
}

/** Header control for customers that own several wedding websites. */
export function WebsiteSelector({ websites, value, onChange, loading }: WebsiteSelectorProps) {
  if (loading) return <Skeleton className="h-8 w-44" />;
  if (!value) return null;

  if (websites.length <= 1) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm" data-testid="website-current">
        <Globe className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{value.websiteName}</span>
        <span className="hidden truncate text-muted-foreground sm:inline">/{value.slug}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[260px] min-w-0 justify-between gap-2" aria-label="Select website">
          <Globe className="text-muted-foreground" />
          <span className="truncate">{value.websiteName}</span>
          <ChevronsUpDown className="ml-auto text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Your wedding websites</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {websites.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => onChange(w.id)} className="items-start gap-3 py-2">
            <Check className={cn('mt-0.5', w.id === value.id ? 'opacity-100' : 'opacity-0')} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{w.websiteName}</span>
              <span className="truncate text-xs text-muted-foreground">
                /{w.slug}
                {!w.isActive && ' · inactive'}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
