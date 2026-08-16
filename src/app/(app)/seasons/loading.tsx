import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton } from "@/components/shared/stat-card-skeleton";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function SeasonsLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          <DataTableSkeleton filterCount={3} columnCount={10} rowCount={10} />
          <div className="flex flex-col gap-4">
            <Card className="gap-3 px-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-6 w-24" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between py-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
            <Card className="gap-3 px-4">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2.5 py-1">
                  <Skeleton className="size-4 shrink-0 rounded-sm" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>

        <div className="flex h-[340px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          Season Performance charts — coming soon
        </div>

        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
