import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const COLUMN_COUNT = 4;
const CARD_COUNT = 5;

export default function DpspFlywheelLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
      <div className="flex items-center gap-4 border-b border-border px-6 py-2.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-5 w-20" />
        ))}
      </div>
      <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
        {/* Mirrors DpspFlywheelToolbar: search, two pickers, four category pills, hide-done. */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-36" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-20 rounded-full" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <Card className="items-center p-6">
              <Skeleton className="h-48 w-48 rounded-full" />
            </Card>
            <Card className="gap-2 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: COLUMN_COUNT }).map((_, columnIndex) => (
              <div key={columnIndex} className="flex flex-col overflow-hidden rounded-lg border border-border">
                <Skeleton className="h-9 w-full rounded-none" />
                <div className="flex flex-col gap-2 p-2">
                  {Array.from({ length: CARD_COUNT }).map((_, cardIndex) => (
                    <Skeleton key={cardIndex} className="h-14 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
