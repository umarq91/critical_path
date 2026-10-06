import { PageHeader } from "@/components/shared/page-header";
import { TimelineWorkspace } from "@/app/(app)/timeline/timeline-workspace";
import { loadTimelineSearchParams } from "@/app/(app)/timeline/timeline-search-params";
import { getTimelineRange, resolveAnchorDate, toQueryDate } from "@/app/(app)/timeline/timeline-utils";
import { listTasksForTimeline, listOverdueTasks } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { listKeyStageOptions } from "@/data/key-stages";
import { listPartyOptions } from "@/data/parties";
import { listHolidaysByDateRange, listDistinctHolidayCountries } from "@/data/holidays";
import { decodeMultiFilterValue } from "@/constants/data-table-filters";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { holidayCountryLabel } from "@/constants/holiday-country";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view, date, seasonId, brandId, keyStageId, owner, involved, q, critical, countries, page, pageSize } =
    await loadTimelineSearchParams(searchParams);
  const range = getTimelineRange(view, resolveAnchorDate(date));
  const filters = {
    season_id: seasonId,
    brand_id: brandId,
    key_stage_id: keyStageId,
    owner,
    involved,
    is_critical: critical,
    search: q,
  };

  const profile = await getCurrentProfile();

  const from = toQueryDate(range.start);
  const to = toQueryDate(range.end);

  const [tasks, overdueTasks, seasons, brands, keyStages, parties, holidays, holidayCountries] = await Promise.all([
    listTasksForTimeline({ from, to, filters, page, pageSize }),
    // The Overdue panel answers "what is late" for the whole board, so it takes the dropdown
    // filters but not the search term — a term typed to find one task shouldn't re-scope it.
    listOverdueTasks({ filters }),
    listSeasonOptions(),
    listBrandOptions(),
    listKeyStageOptions(),
    listPartyOptions(),
    // Every signed-in role sees holidays, external included — same as the Calendar.
    listHolidaysByDateRange({ from, to, countries: decodeMultiFilterValue(countries) }),
    listDistinctHolidayCountries(),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader title="Timeline" description="Tasks laid out against their working dates, grouped by schedule." />
      <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
        <TimelineWorkspace
          tasks={tasks.data}
          rowCount={tasks.rowCount}
          overdueTasks={overdueTasks}
          canAssignPeople={!!profile && can(profile.role, "task.assign")}
          canEditTask={!!profile && can(profile.role, "task.update")}
          seasonOptions={seasons.map((season) => ({ value: season.id, label: season.season }))}
          brandOptions={brands.map((brand) => ({ value: brand.id, label: brand.brand_name }))}
          keyStageOptions={keyStages.map((keyStage) => ({ value: keyStage.id, label: keyStage.name }))}
          partyOptions={parties}
          holidays={holidays}
          holidayCountryOptions={holidayCountries.map((country) => ({
            value: country,
            label: holidayCountryLabel(country),
          }))}
        />
      </div>
    </div>
  );
}
