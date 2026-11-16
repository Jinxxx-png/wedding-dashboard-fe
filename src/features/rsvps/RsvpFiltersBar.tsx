import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchInput } from '@/components/forms/SearchInput';
import { DateRangeFilter } from '@/components/forms/DateRangeFilter';
import type { RsvpFilters, StatusFilter } from './useRsvpFilters';

interface RsvpFiltersBarProps {
  filters: RsvpFilters;
  searchPlaceholder?: string;
  timezone?: string;
  /** Extra controls (e.g. website / customer selects for admins). */
  extra?: ReactNode;
}

export function RsvpFiltersBar({
  filters,
  searchPlaceholder = 'Search guest name or phone…',
  timezone,
  extra,
}: RsvpFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={filters.status} onValueChange={(v) => filters.setStatus(v as StatusFilter)}>
        <TabsList aria-label="Attendance status">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="attending">Attending</TabsTrigger>
          <TabsTrigger value="not_attending">Declined</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={filters.searchInput}
          onChange={filters.setSearchInput}
          placeholder={searchPlaceholder}
          hint={filters.searchHint}
          className="sm:max-w-xs"
        />
        <DateRangeFilter
          value={filters.range}
          onChange={filters.setRange}
          timezoneNote={timezone ? `Dates are interpreted in ${timezone}.` : 'Dates are interpreted in each website’s timezone.'}
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
