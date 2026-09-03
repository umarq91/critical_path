import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton } from "@/components/shared/stat-card-skeleton";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function ManagementTeamsLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <DataTableSkeleton showSearch={false} filterCount={0} columnCount={5} rowCount={10} />
      </div>
    </div>
  );
}
