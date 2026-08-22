import { NextResponse } from "next/server";
import { addSeconds } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserRole } from "@/lib/google/admin-directory";
import { saveGoogleTokens } from "@/lib/google/oauth-tokens";
import { publicEnv } from "@/lib/env";
import { ROUTES } from "@/constants/routes";

// Google's own access tokens last ~3600s; Supabase doesn't surface the provider's exact
// expiry, so this is a deliberately conservative estimate — a little short is harmless
// (lib/google/calendar.ts just refreshes a bit earlier than strictly necessary), a little
// long risks using a token Google's already rejected.
const ASSUMED_PROVIDER_TOKEN_TTL_SECONDS = 3500;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? ROUTES.dashboard;

  if (!code) {
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=auth`, url.origin));
  }

  const supabase = await createClient();
  const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=auth`, url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=auth`, url.origin));
  }

  if (!user.email.toLowerCase().endsWith(`@${publicEnv.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN}`)) {
    await supabase.auth.signOut();
    // exchangeCodeForSession above already created the auth.users row (and, via
    // on_auth_user_created, a profiles row with status 'active') before this domain check
    // ever ran. Left alone, that stray profile shows up in every owner/assignee picker —
    // listAssignableProfiles() filters on status, not domain — even though this person can
    // never sign back in. Delete it now; profiles.id has `on delete cascade` (migration
    // 0001) so one call clears both rows.
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(user.id);
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=domain`, url.origin));
  }

  // Service-role write, deliberately bypassing the self-role-change guard on `profiles`
  // (see migration 0001) — a brand-new user is very often not an admin yet, which is
  // exactly why their role needs to come from an authoritative external source (Google
  // Groups) instead of the profiles row they don't get to edit themselves.
  const resolvedRole = await resolveUserRole(user.email);
  if (resolvedRole) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ role: resolvedRole }).eq("id", user.id);
  }

  // TEMPORARY — per-user OAuth token capture for Calendar sync, the dev-friendly stopgap
  // for domain-wide delegation not reaching personal @gmail.com test accounts (see
  // google-button.tsx's scopes comment and lib/google/calendar.ts). provider_token is only
  // present when the sign-in actually requested the calendar.events scope; older sessions
  // re-authenticating without a fresh consent may come back without one, which is fine —
  // saveGoogleTokens is simply skipped that run.
  const providerToken = exchangeData.session?.provider_token;
  if (providerToken) {
    await saveGoogleTokens(user.id, {
      accessToken: providerToken,
      refreshToken: exchangeData.session?.provider_refresh_token,
      expiresAt: addSeconds(new Date(), ASSUMED_PROVIDER_TOKEN_TTL_SECONDS).toISOString(),
      scope: "https://www.googleapis.com/auth/calendar.events",
    });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
