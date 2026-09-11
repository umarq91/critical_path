import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TIMELINE_PAGE_SIZE } from "@/app/(app)/timeline/timeline-search-params";

// A full page of rows, so the skeleton is the height the real chart lands at.
const ROW_COUNT = TIMELINE_PAGE_SIZE;

export default function TimelineLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-80" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        {/* Mirrors TimelineToolbar's two rows: navigation + period + zoom, then the filter bar. */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-8 w-48" />
            </div>
            <Skeleton className="h-9 w-72" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-80" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-32" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-3">
            {/* Mirrors TimelineGrid: a two-band header, then one row per task. */}
            <div className="overflow-hidden rounded-lg border border-border">
              <Skeleton className="h-22 w-full rounded-none" />
              {Array.from({ length: ROW_COUNT }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 border-t border-border/60 px-3" style={{ height: 44 }}>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="ml-auto h-6 w-1/3 rounded-sm" />
                </div>
              ))}
            </div>
            {/* Pagination row, then the status legend. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-9 w-72" />
            </div>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-24" />
              ))}
            </div>
          </div>

          <Card className="gap-3">
            <div className="px-4">
              <Skeleton className="h-6 w-36" />
            </div>
            <div className="flex flex-col gap-3 px-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
