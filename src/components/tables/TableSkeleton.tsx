import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';

export function TableSkeletonRows({ rows = 6, columns }: { rows?: number; columns: number }) {
  return (
    <TableBody aria-busy="true">
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton className={c === 0 ? 'h-4 w-36' : 'h-4 w-20'} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
