import { PageHeader } from "@/components/shared/page-header";
import { requirePageAccess } from "@/lib/require-page-access";

export default async function SettingsNotificationsPage() {
  await requirePageAccess("admin.manage_lookups");

  return <PageHeader title="Notifications" description="Coming soon." />;
}
