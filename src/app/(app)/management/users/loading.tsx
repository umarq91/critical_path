import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton } from "@/components/shared/stat-card-skeleton";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function ManagementUsersLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <DataTableSkeleton filterCount={3} columnCount={7} rowCount={10} />
      </div>
    </div>
  );
}
