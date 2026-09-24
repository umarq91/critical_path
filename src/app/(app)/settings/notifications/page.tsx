import { PageHeader } from "@/components/shared/page-header";
import { NotificationsInfoCard } from "@/app/(app)/settings/notifications/notifications-info-card";
import { NotificationsConfig } from "@/app/(app)/settings/notifications/notifications-config";
import { ScheduledRemindersTable } from "@/app/(app)/settings/notifications/scheduled-reminders-table";
import { SCHEDULE_QUERY_STATE } from "@/app/(app)/settings/notifications/schedule-query-state";
import { getMyReminderRule, listMyScheduledReminders, REMINDER_ORG_TIMEZONE } from "@/data/reminders";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { listPartyOptions } from "@/data/parties";
import { taskGenderValues } from "@/app/(app)/tasks/schema";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { requirePageAccess } from "@/lib/require-page-access";

// "Australia/Sydney" -> "Sydney" — good enough for the one fixed org timezone (see
// REMINDER_ORG_TIMEZONE's own comment); revisit if that constant ever stops being a plain
// "Region/City" IANA name.
const TIMEZONE_LABEL = REMINDER_ORG_TIMEZONE.split("/").pop()?.replace(/_/g, " ") ?? REMINDER_ORG_TIMEZONE;

// Gated on "profile.update_own", not "admin.manage_lookups" — these are the signed-in user's
// own email reminder preferences (see things-to-know.md's Reminders section), granted to every
// role including external, so this page stays open to everyone rather than admin-only like the
// rest of Settings.
export default async function SettingsNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePageAccess("profile.update_own");
  const queryState = await loadDataTableSearchParams(searchParams, SCHEDULE_QUERY_STATE);

  const [reminderRule, schedule, seasons, brands, parties] = await Promise.all([
    getMyReminderRule(profile.id),
    listMyScheduledReminders(profile.id, queryState),
    listSeasonOptions(),
    listBrandOptions(),
    listPartyOptions(),
  ]);

  const seasonOptions = seasons.map((season) => ({ value: season.id, label: season.season_name }));
  const brandOptions = brands.map((brand) => ({ value: brand.id, label: brand.brand_name }));
  const genderOptions = taskGenderValues.map((value) => ({ value, label: TASK_GENDER_CONFIG[value].label }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Email notifications"
        description="Turn reminders on, then pick your tasks and set when to be emailed about them."
      />
      <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
        <NotificationsInfoCard timezoneLabel={TIMEZONE_LABEL} />
        <NotificationsConfig
          initialIsEnabled={reminderRule?.isEnabled ?? true}
          initialTasks={reminderRule?.tasks ?? []}
          initialRule={reminderRule}
          seasonOptions={seasonOptions}
          ownerOptions={parties}
          brandOptions={brandOptions}
          genderOptions={genderOptions}
          timezoneLabel={TIMEZONE_LABEL}
        />
        <ScheduledRemindersTable
          rows={schedule.data}
          rowCount={schedule.rowCount}
          notifyHour={schedule.notifyHour}
          timezoneLabel={TIMEZONE_LABEL}
        />
      </div>
    </div>
  );
}
