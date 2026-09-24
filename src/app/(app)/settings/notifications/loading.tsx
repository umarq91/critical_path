import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

function StepCardSkeleton() {
  return (
    <Card className="gap-3 px-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-9 w-32" />
    </Card>
  );
}

export default function SettingsNotificationsLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 px-6 py-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
        <Skeleton className="h-14 w-full rounded-xl lg:col-span-2" />
        <StepCardSkeleton />
        <StepCardSkeleton />
        <StepCardSkeleton />
        <div className="lg:col-span-2">
          <DataTableSkeleton filterCount={0} columnCount={3} rowCount={5} showSelectionColumn={false} />
        </div>
      </div>
    </div>
  );
}
