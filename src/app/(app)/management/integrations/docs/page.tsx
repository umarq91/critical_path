import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { EndpointDocRow } from "@/app/(app)/management/integrations/docs/endpoint-doc-row";
import { ENDPOINT_DOCS } from "@/app/(app)/management/integrations/docs/endpoint-docs";
import { requirePageAccess } from "@/lib/require-page-access";

export default async function IntegrationsDocsPage() {
  await requirePageAccess("admin.manage_integrations");

  return (
    <div className="flex flex-col">
      <PageHeader
        title="API Documentation"
        description="Every endpoint in the integration API spec — what's live, what to send, and what to expect back. Same content as docs/databricks-integration-api-spec.md, kept in step with it."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/management/integrations" />}>
            <ArrowLeft />
            Back to Integrations
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="flex flex-col gap-2">
          {ENDPOINT_DOCS.map((endpoint) => (
            <EndpointDocRow key={endpoint.path} endpoint={endpoint} />
          ))}
        </div>
      </div>
    </div>
  );
}
