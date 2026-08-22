import { Skeleton } from "@/components/ui/skeleton";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function UpcomingTasksLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <DataTableSkeleton filterCount={5} columnCount={10} rowCount={15} />
      </div>
    </div>
  );
}
