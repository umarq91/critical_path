import { PageHeader } from "@/components/shared/page-header";
import { requirePageAccess } from "@/lib/require-page-access";

export default async function ReportsPage() {
  await requirePageAccess("dashboard.export_reports");

  return <PageHeader title="Reports" description="Coming soon." />;
}
