import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function IntegrationsLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-[28rem]" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        {/* Matches IntegrationsInfoCard's collapsed-trigger height, open by default — a plain
            row placeholder rather than the DataTableSkeleton shape, since this card is a static
            explanation, not a table. */}
        <Card className="h-14" />
        <DataTableSkeleton filterCount={0} showSearch={false} columnCount={6} rowCount={5} />
      </div>
    </div>
  );
}
