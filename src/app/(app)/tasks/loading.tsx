import { Skeleton } from "@/components/ui/skeleton";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function TasksLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <DataTableSkeleton filterCount={5} columnCount={9} rowCount={15} />
      </div>
    </div>
  );
}
