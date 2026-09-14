import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function IntegrationsDocsLoading() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-[32rem]" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="h-14" />
          ))}
        </div>
      </div>
    </div>
  );
}
