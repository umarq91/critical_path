import { Skeleton } from "@/components/ui/skeleton";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function TasksTrashLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-5 w-[28rem]" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <DataTableSkeleton filterCount={2} columnCount={6} rowCount={8} />
      </div>
    </div>
  );
}
