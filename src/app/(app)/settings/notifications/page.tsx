import { PageHeader } from "@/components/shared/page-header";
import { NotifyTimingCard } from "@/app/(app)/settings/notifications/notify-timing-card";
import { NotifyTasksCard } from "@/app/(app)/settings/notifications/notify-tasks-card";
import { getMyReminderRule } from "@/data/reminders";
import { listSeasonOptions } from "@/data/seasons";
import { listPartyOptions } from "@/data/parties";
import { requirePageAccess } from "@/lib/require-page-access";

// Gated on "profile.update_own", not "admin.manage_lookups" — these are the signed-in user's
// own email reminder preferences (see things-to-know.md's Reminders section), granted to every
// role including external, so this page stays open to everyone rather than admin-only like the
// rest of Settings.
export default async function SettingsNotificationsPage() {
  const profile = await requirePageAccess("profile.update_own");

  const [reminderRule, seasons, parties] = await Promise.all([
    getMyReminderRule(profile.id),
    listSeasonOptions(),
    listPartyOptions(),
  ]);

  const seasonOptions = seasons.map((season) => ({ value: season.id, label: season.season_name }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Email notifications"
        description="Email configuration for your own task reminders — choose when reminder emails go out and which tasks they cover."
      />
      <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
        <NotifyTimingCard initialRule={reminderRule} />
        <NotifyTasksCard
          initialTasks={reminderRule?.tasks ?? []}
          seasonOptions={seasonOptions}
          ownerOptions={parties}
        />
      </div>
    </div>
  );
}
