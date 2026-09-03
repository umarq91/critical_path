import { PageHeader } from "@/components/shared/page-header";
import { requirePageAccess } from "@/lib/require-page-access";

export default async function SettingsGeneralPage() {
  await requirePageAccess("admin.manage_lookups");

  return <PageHeader title="General Settings" description="Coming soon." />;
}
