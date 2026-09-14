import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey, withIntegrationTraceHeaders } from "@/lib/integration-auth";

// The one live endpoint in docs/databricks-integration-api-spec.md so far — see
// things-to-know.md's Integrations section for why the other 16 aren't built yet. Exists to
// prove the foundation end to end: the route resolves outside the session-gated (app) shell,
// requireIntegrationApiKey() accepts a real key and rejects a bad/revoked one, and the response
// matches the spec's exact shape.
export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  return withIntegrationTraceHeaders(
    NextResponse.json({
      status: "ok",
      service: "critical-path-integration-api",
      schema_version: "v1",
      server_time: new Date().toISOString(),
    }),
    request
  );
}
