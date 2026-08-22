import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// google_oauth_tokens has zero RLS policies (see 0013_google_oauth_tokens.sql) — these are
// live API credentials, not display data, so even the owning user can't read their own row
// through the normal per-request client. This module is the one place allowed to touch the
// table, always via the service-role client, always scoped to a specific profileId by hand.

export interface StoredGoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

export async function getStoredGoogleTokens(profileId: string): Promise<StoredGoogleTokens | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) return null;
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at };
}

export async function hasGoogleCalendarToken(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("google_oauth_tokens")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  return !!count && count > 0;
}

// Called from auth/callback/route.ts right after sign-in, and from lib/google/calendar.ts
// whenever googleapis silently refreshes an expired access_token — both are "we now have
// the freshest credentials, persist them" moments.
export async function saveGoogleTokens(
  profileId: string,
  { accessToken, refreshToken, expiresAt, scope }: { accessToken: string; refreshToken?: string | null; expiresAt: string; scope?: string | null }
): Promise<void> {
  const admin = createAdminClient();

  // Google only re-sends a refresh_token on the very first consent (or when prompt=consent
  // forces re-consent) — a routine access_token refresh has no refresh_token to report, so
  // don't let that silently null out the one already on file.
  const existing = refreshToken === undefined || refreshToken === null ? await getStoredGoogleTokens(profileId) : null;

  await admin.from("google_oauth_tokens").upsert(
    {
      profile_id: profileId,
      access_token: accessToken,
      refresh_token: refreshToken ?? existing?.refreshToken ?? null,
      expires_at: expiresAt,
      scope: scope ?? undefined,
    },
    { onConflict: "profile_id" }
  );
}
