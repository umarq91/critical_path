import "server-only";
import type { NextResponse, NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/integration/keys";
import { integrationError } from "@/lib/integration/response";

export type IntegrationAuthResult = { ok: true; keyId: string } | { ok: false; response: NextResponse };

// First line of every /integration/v1/* route — the integration API's counterpart to
// requireCronAuth (lib/cron-auth.ts), for the same reason: the caller here is Kong, not a
// signed-in browser, so there is no Supabase session to check. Unlike cron's single shared
// secret, this looks an individual key up by its hash (see lib/integration/keys.ts) so a key
// can be named, tied to whoever created it, and revoked on its own without rotating every
// other integration's credentials.
//
// Uses the service-role client deliberately: api_keys' RLS is admin-only (see
// 0025_api_keys.sql), and this caller has no profile row to satisfy that policy with — same
// reasoning lib/supabase/admin.ts already documents for cron/export routes.
export async function requireIntegrationApiKey(request: NextRequest): Promise<IntegrationAuthResult> {
  const apiKey = request.headers.get("apikey");
  if (!apiKey) return { ok: false, response: integrationError(request, 401, "Missing apikey header") };

  const supabase = createAdminClient();
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, status")
    .eq("key_hash", hashApiKey(apiKey))
    .maybeSingle();

  if (!key || key.status !== "active") {
    return { ok: false, response: integrationError(request, 401, "Invalid or revoked API key") };
  }

  // Best-effort — an admin browsing /management/integrations wants a rough "last seen" signal,
  // not a guarantee. supabase-js returns a { error } result rather than throwing, so this is
  // "fire, ignore the outcome" by construction: a failed write here must not turn a valid,
  // authenticated request into a 500 for the integration calling it.
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return { ok: true, keyId: key.id };
}
