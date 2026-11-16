import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumber } from '@/utils/format';
import type { PageMeta } from '@/types/api';

interface DataTablePaginationProps {
  meta?: PageMeta;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  disabled?: boolean;
}

/** Server-side pagination controls driven by the API `meta` object. */
export function DataTablePagination({
  meta,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemLabel = 'results',
  disabled,
}: DataTablePaginationProps) {
  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const total = meta?.totalItems ?? 0;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasNext = meta?.hasNext ?? page < totalPages;

  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 px-1 py-3 text-sm sm:flex-row">
      <p className="text-muted-foreground tabular" aria-live="polite">
        {total === 0 ? `No ${itemLabel}` : `${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)} ${itemLabel}`}
      </p>
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-muted-foreground">Rows</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))} disabled={disabled}>
              <SelectTrigger size="sm" className="w-[72px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="text-muted-foreground tabular">
          Page {formatNumber(page)} of {formatNumber(totalPages)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            onClick={() => onPageChange(1)}
            disabled={disabled || page <= 1}
            aria-label="First page"
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || !hasNext}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            onClick={() => onPageChange(totalPages)}
            disabled={disabled || page >= totalPages}
            aria-label="Last page"
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
