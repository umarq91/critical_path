import { PageHeader } from "@/components/shared/page-header";
import { requirePageAccess } from "@/lib/require-page-access";

export default async function SettingsIntegrationsPage() {
  await requirePageAccess("admin.manage_lookups");

  return <PageHeader title="Integrations" description="Coming soon." />;
}
