import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

interface DataTableSkeletonProps {
  /** How many toolbar filter selects to show placeholders for (search box is separate, see showSearch). */
  filterCount?: number;
  showSearch?: boolean;
  columnCount?: number;
  rowCount?: number;
  /** Leading checkbox column, if the real table has enableRowSelection. */
  showSelectionColumn?: boolean;
}

// Mirrors DataTable's own Card/toolbar/table/pagination structure so the swap-in on load
// doesn't shift layout. Use this in every route's loading.tsx that renders a DataTable —
// pass roughly the same columnCount/filterCount as the real table for a closer match.
export const DataTableSkeleton = ({
  filterCount = 3,
  showSearch = true,
  columnCount = 6,
  rowCount = 8,
  showSelectionColumn = false,
}: DataTableSkeletonProps) => {
  const columns = Array.from({ length: columnCount });
  const rows = Array.from({ length: rowCount });

  return (
    <Card className="gap-5 py-6">
      <div className="flex flex-wrap items-center gap-3 px-6">
        {showSearch ? <Skeleton className="h-10 w-64" /> : null}
        {Array.from({ length: filterCount }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-32" />
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {showSelectionColumn ? (
              <TableCell className="px-3 py-2.5">
                <Skeleton className="size-4 rounded-sm" />
              </TableCell>
            ) : null}
            {columns.map((_, index) => (
              <TableCell key={index} className="px-3 py-2.5">
                <Skeleton className="h-4 w-20" />
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((_, rowIndex) => (
            <TableRow key={rowIndex} className="hover:bg-transparent">
              {showSelectionColumn ? (
                <TableCell className="px-3 py-2.5">
                  <Skeleton className="size-4 rounded-sm" />
                </TableCell>
              ) : null}
              {columns.map((_, colIndex) => (
                <TableCell key={colIndex} className="px-3 py-2.5">
                  <Skeleton className="h-4 w-full max-w-24" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </Card>
  );
};
