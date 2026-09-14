import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/integration-keys";

export type IntegrationAuthResult = { ok: true; keyId: string } | { ok: false; response: NextResponse };

// The spec lists X-Request-Id/X-Correlation-Id as required Kong headers (see
// docs/databricks-integration-api-spec.md) — not enforced (a missing one doesn't reject the
// request, since Kong's actual outgoing header set isn't confirmed yet), but echoed back
// verbatim on every response, success or 401. That's the traceability the spec is actually
// after: the caller can match a response to the request that produced it, and correlate it
// against Kong/Databricks' own logs for that sync run, without this app needing a request-log
// table or (CLAUDE.md-barred) console.log to get there.
export function withIntegrationTraceHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const requestId = request.headers.get("x-request-id");
  const correlationId = request.headers.get("x-correlation-id");
  if (requestId) response.headers.set("X-Request-Id", requestId);
  if (correlationId) response.headers.set("X-Correlation-Id", correlationId);
  return response;
}

function unauthorized(request: NextRequest, message: string): NextResponse {
  return withIntegrationTraceHeaders(NextResponse.json({ error: message }, { status: 401 }), request);
}

// First line of every /integration/v1/* route — the integration API's counterpart to
// requireCronAuth (lib/cron-auth.ts), for the same reason: the caller here is Kong, not a
// signed-in browser, so there is no Supabase session to check. Unlike cron's single shared
// secret, this looks an individual key up by its hash (see lib/integration-keys.ts) so a key
// can be named, tied to whoever created it, and revoked on its own without rotating every
// other integration's credentials.
//
// Uses the service-role client deliberately: api_keys' RLS is admin-only (see
// 0025_api_keys.sql), and this caller has no profile row to satisfy that policy with — same
// reasoning lib/supabase/admin.ts already documents for cron/export routes.
export async function requireIntegrationApiKey(request: NextRequest): Promise<IntegrationAuthResult> {
  const apiKey = request.headers.get("apikey");
  if (!apiKey) return { ok: false, response: unauthorized(request, "Missing apikey header") };

  const supabase = createAdminClient();
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, status")
    .eq("key_hash", hashApiKey(apiKey))
    .maybeSingle();

  if (!key || key.status !== "active") {
    return { ok: false, response: unauthorized(request, "Invalid or revoked API key") };
  }

  // Best-effort — an admin browsing /management/integrations wants a rough "last seen" signal,
  // not a guarantee. supabase-js returns a { error } result rather than throwing, so this is
  // "fire, ignore the outcome" by construction: a failed write here must not turn a valid,
  // authenticated request into a 500 for the integration calling it.
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return { ok: true, keyId: key.id };
}
