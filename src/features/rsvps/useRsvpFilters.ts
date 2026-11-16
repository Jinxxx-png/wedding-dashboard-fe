import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDefaultPageSize } from '@/hooks/useDefaultPageSize';
import { normalizeSearch } from '@/utils/search';
import type { DateRange } from '@/components/forms/DateRangeFilter';
import type { AttendanceStatus, ListQuery, RsvpSortBy, SortOrder } from '@/types/api';

export type StatusFilter = 'all' | AttendanceStatus;

const DEFAULT_ORDER: Record<RsvpSortBy, SortOrder> = {
  createdAt: 'desc',
  guestName: 'asc',
  numberOfGuests: 'desc',
};

/**
 * Server-side list state for RSVP-based tables (search, status, date range, sort, paging).
 * Encodes the backend rules: debounced search with minimum lengths, and date filters
 * only combinable with `sortBy=createdAt`.
 */
export function useRsvpFilters() {
  const defaultPageSize = useDefaultPageSize();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const search = useMemo(() => normalizeSearch(debouncedSearch), [debouncedSearch]);
  const [status, setStatusState] = useState<StatusFilter>('all');
  const [range, setRangeState] = useState<DateRange>({});
  const [sortBy, setSortBy] = useState<RsvpSortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const rangeActive = Boolean(range.from || range.to);

  // New search term → back to the first page.
  const lastSearch = useRef(search.value);
  useEffect(() => {
    if (lastSearch.current !== search.value) {
      lastSearch.current = search.value;
      setPage(1);
    }
  }, [search.value]);

  const setStatus = (s: StatusFilter) => {
    setStatusState(s);
    setPage(1);
  };

  const setRange = (r: DateRange) => {
    setRangeState(r);
    setPage(1);
    // Date filters can only be combined with sortBy=createdAt (otherwise the API returns 422).
    if (r.from || r.to) setSortBy('createdAt');
  };

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };

  const toggleSort = (key: RsvpSortBy) => {
    if (rangeActive && key !== 'createdAt') return;
    if (key === sortBy) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortOrder(DEFAULT_ORDER[key]);
    }
    setPage(1);
  };

  const query: ListQuery = {
    page,
    pageSize,
    search: search.value,
    attendanceStatus: status === 'all' ? undefined : status,
    from: range.from,
    to: range.to,
    sortBy,
    sortOrder,
  };

  /** Filters forwarded to exports (no pagination). */
  const exportFilters: ListQuery = {
    search: search.value,
    attendanceStatus: query.attendanceStatus,
    from: range.from,
    to: range.to,
    sortBy,
    sortOrder,
  };

  const filtersActive = Boolean(search.value || status !== 'all' || rangeActive);

  const reset = () => {
    setSearchInput('');
    setStatusState('all');
    setRangeState({});
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  return {
    searchInput,
    setSearchInput,
    searchHint: search.hint,
    status,
    setStatus,
    range,
    setRange,
    rangeActive,
    sortBy,
    sortOrder,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    query,
    exportFilters,
    filtersActive,
    reset,
  };
}

export type RsvpFilters = ReturnType<typeof useRsvpFilters>;
