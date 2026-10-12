import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton } from "@/components/shared/stat-card-skeleton";
import { ChartCardSkeleton } from "@/components/charts/chart-card-skeleton";
import { TASK_FIELD_VISIBILITY } from "@/constants/task-field-visibility";
import { cn } from "@/lib/utils";

const DONUT_BODY_CLASS = "mx-auto size-[200px] rounded-full";

// TimelineGanttCard's grid at its row cap: a two-band header plus TIMELINE_PREVIEW_ROW_COUNT
// rows, all ROW_HEIGHT (44px) tall. Spelled out because Tailwind can't see a computed class.
const GANTT_BODY_CLASS = "h-[616px] w-full";

// Mirrors which cards page.tsx shows while Status/Brand/Gender are hidden.
const { status: showStatus, brand: showBrand, gender: showGender, overdue: showOverdue } = TASK_FIELD_VISIBILITY;

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
        {showStatus ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : null}

        <div className={cn("grid grid-cols-1 gap-4", showStatus && "lg:grid-cols-2")}>
          <ChartCardSkeleton bodyClassName={DONUT_BODY_CLASS} />
          {showStatus ? <ChartCardSkeleton bodyClassName={DONUT_BODY_CLASS} /> : null}
        </div>

        {showStatus || showBrand || showGender ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {showStatus ? <ChartCardSkeleton bodyClassName={DONUT_BODY_CLASS} legendCount={2} /> : null}
            {showBrand ? (
              <ChartCardSkeleton className="lg:col-span-2" bodyClassName="h-[200px] w-full" legendCount={0} />
            ) : null}
            {showGender ? <ChartCardSkeleton bodyClassName={DONUT_BODY_CLASS} legendCount={3} /> : null}
          </div>
        ) : null}

        {showStatus ? <ChartCardSkeleton bodyClassName="h-[280px] w-full" legendCount={0} /> : null}

        <div className={cn("grid grid-cols-1 gap-4", showOverdue && "xl:grid-cols-[minmax(0,1fr)_300px]")}>
          <ChartCardSkeleton bodyClassName={GANTT_BODY_CLASS} legendCount={4} />
          {showOverdue ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
