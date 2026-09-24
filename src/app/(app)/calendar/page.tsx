import { PageHeader } from "@/components/shared/page-header";
import { CalendarWorkspace } from "@/app/(app)/calendar/calendar-workspace";
import { loadCalendarSearchParams } from "@/app/(app)/calendar/calendar-search-params";
import { getCalendarRange, resolveAnchorDate, toQueryDate, toTaskRangeFilters } from "@/app/(app)/calendar/calendar-utils";
import { listTasksByDueDateRange } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { listPartyOptions } from "@/data/parties";
import { listHolidaysByDateRange, listDistinctHolidayCountries } from "@/data/holidays";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { isGoogleCalendarEligible } from "@/lib/calendar-eligibility";
import { taskStatusValues, taskGenderValues } from "@/app/(app)/tasks/schema";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";

const STATUS_OPTIONS = taskStatusValues.map((status) => ({
  value: status,
  label: TASK_STATUS_CONFIG[status]?.label ?? status,
}));

const GENDER_OPTIONS = taskGenderValues.map((gender) => ({
  value: gender,
  label: TASK_GENDER_CONFIG[gender]?.label ?? gender,
}));

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view, date, countries, ...taskFilterState } = await loadCalendarSearchParams(searchParams);
  const anchorDate = resolveAnchorDate(date);
  const range = getCalendarRange(view, anchorDate);

  const profile = await getCurrentProfile();
  const canAssignPeople = !!profile && can(profile.role, "task.assign");
  // External users have no Workspace Google account, so the Sync control is never rendered
  // for them — the server action refuses the same call independently (see _actions.ts).
  const canSyncGoogleCalendar = !!profile && isGoogleCalendarEligible(profile);

  // The Owner / People Involved options are every department and active person in the
  // organisation, the same whole-org list lookups.view guards elsewhere. External users don't
  // get it, so those two filters simply don't render for them (no options, no dropdown).
  const canFilterByParty = !!profile && can(profile.role, "lookups.view");

  const [tasks, seasons, brands, partyOptions, holidays, holidayCountries] = await Promise.all([
    listTasksByDueDateRange({
      from: toQueryDate(range.start),
      to: toQueryDate(range.end),
      filters: toTaskRangeFilters(taskFilterState),
      involvesProfileId: profile?.id,
    }),
    listSeasonOptions(),
    listBrandOptions(),
    canFilterByParty ? listPartyOptions() : Promise.resolve([]),
    // Visible to every signed-in role including external — a public holiday date isn't
    // organisation-sensitive the way brand/season lookups are (see docs/specs/0001-public-holidays).
    listHolidaysByDateRange({
      from: toQueryDate(range.start),
      to: toQueryDate(range.end),
      countries: countries.length > 0 ? countries : undefined,
    }),
    listDistinctHolidayCountries(),
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
          holidays={holidays}
          holidayCountryOptions={holidayCountries.map((country) => ({ value: country, label: country }))}
          canAssignPeople={canAssignPeople}
          canSyncGoogleCalendar={canSyncGoogleCalendar}
          seasonOptions={seasonOptions}
          brandOptions={brandOptions}
          partyOptions={partyOptions}
          statusOptions={STATUS_OPTIONS}
          genderOptions={GENDER_OPTIONS}
        />
      </div>
    </div>
  );
}
