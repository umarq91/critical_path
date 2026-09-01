import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton } from "@/components/shared/stat-card-skeleton";
import { ChartCardSkeleton } from "@/components/charts/chart-card-skeleton";

const DONUT_BODY_CLASS = "mx-auto size-[200px] rounded-full";

// TimelineGanttCard's grid at its row cap: a two-band header plus TIMELINE_PREVIEW_ROW_COUNT
// rows, all ROW_HEIGHT (44px) tall. Spelled out because Tailwind can't see a computed class.
const GANTT_BODY_CLASS = "h-[616px] w-full";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCardSkeleton bodyClassName={DONUT_BODY_CLASS} />
          <ChartCardSkeleton bodyClassName={DONUT_BODY_CLASS} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <ChartCardSkeleton bodyClassName={DONUT_BODY_CLASS} legendCount={2} />
          <ChartCardSkeleton className="lg:col-span-2" bodyClassName="h-[200px] w-full" legendCount={0} />
          <ChartCardSkeleton bodyClassName={DONUT_BODY_CLASS} legendCount={3} />
        </div>

        <ChartCardSkeleton bodyClassName="h-[280px] w-full" legendCount={0} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <ChartCardSkeleton bodyClassName={GANTT_BODY_CLASS} legendCount={4} />
          <Card className="gap-3">
            <div className="px-4">
              <Skeleton className="h-6 w-36" />
            </div>
            <div className="flex flex-col gap-3 px-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
