import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartCardSkeletonProps {
  className?: string;
  /** Shape of the plot placeholder — a donut card passes a circle, a bar card the default block. */
  bodyClassName?: string;
  legendCount?: number;
}

// Mirrors <ChartCard>'s header/body/legend structure so a chart swapping in on load doesn't
// shift the grid around it.
export const ChartCardSkeleton = ({ className, bodyClassName, legendCount = 4 }: ChartCardSkeletonProps) => {
  return (
    <Card className={cn("gap-4", className)}>
      <div className="flex flex-col gap-2 px-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="px-4">
        <Skeleton className={bodyClassName ?? "h-[300px] w-full"} />
      </div>
      <div className="flex flex-wrap gap-3 px-4">
        {Array.from({ length: legendCount }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-24" />
        ))}
      </div>
    </Card>
  );
};
