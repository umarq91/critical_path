import { PageHeader } from "@/components/shared/page-header";
import { TimelineWorkspace } from "@/app/(app)/timeline/timeline-workspace";
import { loadTimelineSearchParams } from "@/app/(app)/timeline/timeline-search-params";
import { getTimelineRange, resolveAnchorDate, toQueryDate } from "@/app/(app)/timeline/timeline-utils";
import { listTasksForTimeline, listOverdueTasks } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view, date, seasonId, brandId } = await loadTimelineSearchParams(searchParams);
  const range = getTimelineRange(view, resolveAnchorDate(date));
  const filters = { season_id: seasonId, brand_id: brandId };

  const profile = await getCurrentProfile();

  const [tasks, overdueTasks, seasons, brands] = await Promise.all([
    listTasksForTimeline({ from: toQueryDate(range.start), to: toQueryDate(range.end), filters }),
    listOverdueTasks({ filters }),
    listSeasonOptions(),
    listBrandOptions(),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader title="Timeline" description="Tasks laid out against their working dates, grouped by schedule." />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <TimelineWorkspace
          tasks={tasks}
          overdueTasks={overdueTasks}
          canAssignPeople={!!profile && can(profile.role, "task.assign")}
          seasonOptions={seasons.map((season) => ({ value: season.id, label: season.season_name }))}
          brandOptions={brands.map((brand) => ({ value: brand.id, label: brand.brand_name }))}
        />
      </div>
    </div>
  );
}
