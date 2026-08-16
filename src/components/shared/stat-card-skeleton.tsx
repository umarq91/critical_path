import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors StatCard's exact layout so the swap-in on load doesn't shift anything.
export const StatCardSkeleton = () => {
  return (
    <Card className="flex-row items-start gap-3 px-4">
      <Skeleton className="size-11 shrink-0 rounded-lg" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-14" />
        <Skeleton className="h-3.5 w-28" />
      </div>
    </Card>
  );
};
