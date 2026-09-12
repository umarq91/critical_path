import { PageHeader } from "@/components/shared/page-header";
import { CriticalPathTabs } from "@/components/shared/critical-path-tabs";
import { TimelineWorkspace } from "@/app/(app)/timeline/timeline-workspace";
import { loadTimelineSearchParams } from "@/app/(app)/timeline/timeline-search-params";
import { getTimelineRange, resolveAnchorDate, toQueryDate } from "@/app/(app)/timeline/timeline-utils";
import { listTasksForTimeline, listOverdueTasks } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { listKeyStageOptions } from "@/data/key-stages";
import { listPartyOptions } from "@/data/parties";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view, date, seasonId, brandId, keyStageId, owner, involved, q, page, pageSize } =
    await loadTimelineSearchParams(searchParams);
  const range = getTimelineRange(view, resolveAnchorDate(date));
  const filters = { season_id: seasonId, brand_id: brandId, key_stage_id: keyStageId, owner, involved, search: q };

  const profile = await getCurrentProfile();

  const [tasks, overdueTasks, seasons, brands, keyStages, parties] = await Promise.all([
    listTasksForTimeline({ from: toQueryDate(range.start), to: toQueryDate(range.end), filters, page, pageSize }),
    // The Overdue panel answers "what is late" for the whole board, so it takes the dropdown
    // filters but not the search term — a term typed to find one task shouldn't re-scope it.
    listOverdueTasks({ filters }),
    listSeasonOptions(),
    listBrandOptions(),
    listKeyStageOptions(),
    listPartyOptions(),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader title="Timeline" description="Tasks laid out against their working dates, grouped by schedule." />
      <CriticalPathTabs active="timeline" />
      <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
        <TimelineWorkspace
          tasks={tasks.data}
          rowCount={tasks.rowCount}
          overdueTasks={overdueTasks}
          canAssignPeople={!!profile && can(profile.role, "task.assign")}
          seasonOptions={seasons.map((season) => ({ value: season.id, label: season.season_name }))}
          brandOptions={brands.map((brand) => ({ value: brand.id, label: brand.brand_name }))}
          keyStageOptions={keyStages.map((keyStage) => ({ value: keyStage.id, label: keyStage.name }))}
          partyOptions={parties}
        />
      </div>
    </div>
  );
}
