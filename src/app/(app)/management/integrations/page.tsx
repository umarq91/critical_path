import { PageHeader } from "@/components/shared/page-header";
import { IntegrationsBoard } from "@/app/(app)/management/integrations/integrations-board";
import { IntegrationsInfoCard } from "@/app/(app)/management/integrations/integrations-info-card";
import { CreateApiKeyDialog } from "@/app/(app)/management/integrations/create-api-key-dialog";
import { listApiKeys } from "@/data/api-keys";
import { requirePageAccess } from "@/lib/require-page-access";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";
import { publicEnv } from "@/lib/env";

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "created_at", desc: true } };

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("admin.manage_integrations");
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const { data: apiKeys, rowCount } = await listApiKeys(queryState);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Integrations"
        description="API keys for the read-only integration API. Only /health is live today — data endpoints are added one at a time."
        action={<CreateApiKeyDialog />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <IntegrationsInfoCard baseUrl={publicEnv.NEXT_PUBLIC_APP_URL} />
        <IntegrationsBoard apiKeys={apiKeys} rowCount={rowCount} />
      </div>
    </div>
  );
}
