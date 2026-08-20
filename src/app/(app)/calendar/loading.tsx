import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <Card className="animate-in fade-in-0 duration-300">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-52" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-6 w-36" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-7 border-b border-border bg-muted">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="px-3 py-3">
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex min-h-40 flex-col gap-1.5 border-b border-r border-border p-2.5 last:border-r-0 lg:min-h-48"
                  >
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-5 w-full rounded-md" />
                    <Skeleton className="h-5 w-4/5 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
