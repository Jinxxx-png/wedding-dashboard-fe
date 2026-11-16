import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDefaultPageSize } from '@/hooks/useDefaultPageSize';
import { normalizeSearch } from '@/utils/search';
import type { DateRange } from '@/components/forms/DateRangeFilter';
import type { ListQuery, SortOrder } from '@/types/api';

export type WishView = 'all' | 'visible' | 'hidden' | 'favourites';

export function useWishFilters(initialPageSize = 12) {
  const preferred = useDefaultPageSize(initialPageSize);
  const [searchInput, setSearchInput] = useState('');
  const debounced = useDebouncedValue(searchInput, 300);
  const search = useMemo(() => normalizeSearch(debounced, { allowPhone: false }), [debounced]);
  const [view, setViewState] = useState<WishView>('all');
  const [sortOrder, setSortOrderState] = useState<SortOrder>('desc');
  const [range, setRangeState] = useState<DateRange>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(preferred);

  const lastSearch = useRef(search.value);
  useEffect(() => {
    if (lastSearch.current !== search.value) {
      lastSearch.current = search.value;
      setPage(1);
    }
  }, [search.value]);

  const withReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const filterParams: ListQuery = {
    search: search.value,
    isVisible: view === 'visible' ? true : view === 'hidden' ? false : undefined,
    isFavourite: view === 'favourites' ? true : undefined,
    from: range.from,
    to: range.to,
    sortOrder,
  };

  return {
    searchInput,
    setSearchInput,
    searchHint: search.hint,
    view,
    setView: withReset(setViewState),
    sortOrder,
    setSortOrder: withReset(setSortOrderState),
    range,
    setRange: withReset(setRangeState),
    page,
    setPage,
    pageSize,
    setPageSize: withReset(setPageSizeState),
    query: { ...filterParams, page, pageSize } as ListQuery,
    exportFilters: filterParams,
    filtersActive: Boolean(search.value || view !== 'all' || range.from || range.to),
    reset: () => {
      setSearchInput('');
      setViewState('all');
      setRangeState({});
      setSortOrderState('desc');
      setPage(1);
    },
  };
}

export type WishFilters = ReturnType<typeof useWishFilters>;
