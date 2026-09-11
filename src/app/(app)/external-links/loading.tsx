import { Skeleton } from "@/components/ui/skeleton";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function ExternalLinksLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        {/* Title, description, link, added-on, actions. */}
        <DataTableSkeleton showSearch={false} filterCount={0} columnCount={5} rowCount={10} />
      </div>
    </div>
  );
}
