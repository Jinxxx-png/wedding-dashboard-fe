import { Eye, EyeOff, Maximize2, MoreHorizontal, Star, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VisibilityBadge } from '@/components/shared/StatusBadges';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelative, initials } from '@/utils/format';
import type { Wish } from '@/types/api';

const LONG_MESSAGE = 220;

interface WishCardProps {
  wish: Wish;
  timezone?: string;
  websiteLabel?: string;
  onOpen: (wish: Wish) => void;
  /** Moderation handlers — omitted when the backend does not permit the action. */
  onToggleVisible?: (wish: Wish) => void;
  onToggleFavourite?: (wish: Wish) => void;
  onDelete?: (wish: Wish) => void;
  pending?: boolean;
}

export function WishCard({
  wish,
  timezone,
  websiteLabel,
  onOpen,
  onToggleVisible,
  onToggleFavourite,
  onDelete,
  pending,
}: WishCardProps) {
  const long = wish.message.length > LONG_MESSAGE || wish.message.split('\n').length > 5;

  return (
    <Card className={cn('gap-3 py-4 transition-opacity', !wish.isVisible && 'bg-zinc-50/80', pending && 'opacity-70')}>
      <div className="flex items-start gap-3 px-4">
        <Avatar className="size-9">
          <AvatarFallback>{initials(wish.senderName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{wish.senderName}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="w-fit text-xs text-muted-foreground">{formatRelative(wish.createdAt)}</p>
            </TooltipTrigger>
            <TooltipContent>{formatDateTime(wish.createdAt, timezone)}</TooltipContent>
          </Tooltip>
          {websiteLabel && <p className="truncate text-xs text-muted-foreground">{websiteLabel}</p>}
        </div>
        {onToggleFavourite ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleFavourite(wish)}
            disabled={pending}
            aria-pressed={wish.isFavourite}
            aria-label={wish.isFavourite ? 'Remove from favourites' : 'Mark as favourite'}
          >
            <Star className={cn(wish.isFavourite ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')} />
          </Button>
        ) : (
          wish.isFavourite && <Star className="size-4 fill-amber-400 text-amber-500" aria-label="Favourite" />
        )}
      </div>

      <button type="button" onClick={() => onOpen(wish)} className="px-4 text-left" aria-label={`Read wish from ${wish.senderName}`}>
        {/* Plain text only — React escapes it; never rendered as HTML. */}
        <p className="line-clamp-5 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{wish.message}</p>
        {long && <span className="mt-1 inline-block text-xs font-medium text-muted-foreground hover:text-foreground">Read more</span>}
      </button>

      <div className="mt-auto flex items-center justify-between gap-2 border-t px-4 pt-3">
        {onToggleVisible ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={wish.isVisible}
              onCheckedChange={() => onToggleVisible(wish)}
              disabled={pending}
              aria-label="Show on website"
            />
            {wish.isVisible ? (
              <span className="flex items-center gap-1">
                <Eye className="size-3.5" /> Shown on website
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700">
                <EyeOff className="size-3.5" /> Hidden
              </span>
            )}
          </label>
        ) : (
          <VisibilityBadge visible={wish.isVisible} />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More actions for wish from ${wish.senderName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(wish)}>
              <Maximize2 /> View full message
            </DropdownMenuItem>
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(wish)}>
                  <Trash2 /> Delete wish
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
