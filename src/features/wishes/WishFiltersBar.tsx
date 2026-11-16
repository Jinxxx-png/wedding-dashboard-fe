import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/forms/SearchInput';
import { DateRangeFilter } from '@/components/forms/DateRangeFilter';
import type { WishFilters, WishView } from './useWishFilters';
import type { SortOrder } from '@/types/api';

interface WishFiltersBarProps {
  filters: WishFilters;
  hiddenLabel?: string;
  timezone?: string;
  extra?: ReactNode;
}

export function WishFiltersBar({ filters, hiddenLabel = 'Hidden', timezone, extra }: WishFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={filters.view} onValueChange={(v) => filters.setView(v as WishView)}>
        <TabsList aria-label="Wish visibility">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="visible">Visible</TabsTrigger>
          <TabsTrigger value="hidden">{hiddenLabel}</TabsTrigger>
          <TabsTrigger value="favourites">Favourites</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={filters.searchInput}
          onChange={filters.setSearchInput}
          placeholder="Search by sender name…"
          hint={filters.searchHint}
          className="sm:max-w-xs"
        />
        <Select value={filters.sortOrder} onValueChange={(v) => filters.setSortOrder(v as SortOrder)}>
          <SelectTrigger className="sm:w-[150px]" aria-label="Sort order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest first</SelectItem>
            <SelectItem value="asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter
          value={filters.range}
          onChange={filters.setRange}
          timezoneNote={timezone ? `Dates are interpreted in ${timezone}.` : undefined}
        />
        {extra}
        {filters.filtersActive && (
          <Button variant="ghost" size="sm" onClick={filters.reset} className="text-muted-foreground">
            <RotateCcw /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
