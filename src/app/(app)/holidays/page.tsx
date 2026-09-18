import { PageHeader } from "@/components/shared/page-header";
import { HolidayPageActions } from "@/app/(app)/holidays/holiday-page-actions";
import { HolidaysBoard } from "@/app/(app)/holidays/holidays-board";
import { listHolidays, listDistinctHolidayCountries } from "@/data/holidays";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/require-page-access";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";
import { HOLIDAYS_QUERY_STATE } from "@/app/(app)/holidays/query-state";

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Same split as every other lookup without its own Role-Based Access row: lookups.view to
  // see the list (admin/standard_user/viewer, not external), admin.manage_lookups to change it.
  await requirePageAccess("lookups.view");
  const queryState = await loadDataTableSearchParams(searchParams, HOLIDAYS_QUERY_STATE);

  const [{ data: holidays, rowCount }, countries, profile] = await Promise.all([
    listHolidays(queryState),
    listDistinctHolidayCountries(),
    getCurrentProfile(),
  ]);
  const canManage = !!profile && can(profile.role, "admin.manage_lookups");
  const countryOptions = countries.map((country) => ({ value: country, label: country }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Holidays"
        description="Manage the public holidays shown on the Calendar."
        action={<HolidayPageActions canManage={canManage} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <HolidaysBoard holidays={holidays} rowCount={rowCount} canManage={canManage} countryOptions={countryOptions} />
      </div>
    </div>
  );
}
