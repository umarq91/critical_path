import { PageHeader } from "@/components/shared/page-header";
import { CalendarWorkspace } from "@/app/(app)/calendar/calendar-workspace";
import { loadCalendarSearchParams } from "@/app/(app)/calendar/calendar-search-params";
import { getCalendarRange, resolveAnchorDate, toQueryDate } from "@/app/(app)/calendar/calendar-utils";
import { listTasksByDueDateRange } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { isGoogleCalendarEligible } from "@/lib/calendar-eligibility";
import { taskStatusValues } from "@/app/(app)/tasks/schema";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";

const STATUS_OPTIONS = taskStatusValues.map((status) => ({
  value: status,
  label: TASK_STATUS_CONFIG[status]?.label ?? status,
}));

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view, date, seasonId, brandId, status } = await loadCalendarSearchParams(searchParams);
  const anchorDate = resolveAnchorDate(date);
  const range = getCalendarRange(view, anchorDate);

  const profile = await getCurrentProfile();
  const canAssignPeople = !!profile && can(profile.role, "task.assign");
  // External users have no Workspace Google account, so the Sync control is never rendered
  // for them — the server action refuses the same call independently (see _actions.ts).
  const canSyncGoogleCalendar = !!profile && isGoogleCalendarEligible(profile);

  const [tasks, seasons, brands] = await Promise.all([
    listTasksByDueDateRange({
      from: toQueryDate(range.start),
      to: toQueryDate(range.end),
      filters: { season_id: seasonId, brand_id: brandId, status },
      involvesProfileId: profile?.id,
    }),
    listSeasonOptions(),
    listBrandOptions(),
  ]);

  const seasonOptions = seasons.map((season) => ({ value: season.id, label: season.season_name }));
  const brandOptions = brands.map((brand) => ({ value: brand.id, label: brand.brand_name }));

  return (
    <div className="flex flex-col">
      <PageHeader title="Calendar" description="View and manage your tasks by due date on a calendar." />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <CalendarWorkspace
          view={view}
          anchorDate={anchorDate}
          range={range}
          tasks={tasks}
          canAssignPeople={canAssignPeople}
          canSyncGoogleCalendar={canSyncGoogleCalendar}
          seasonOptions={seasonOptions}
          brandOptions={brandOptions}
          statusOptions={STATUS_OPTIONS}
        />
      </div>
    </div>
  );
}
