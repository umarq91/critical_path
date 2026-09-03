import { NextResponse } from "next/server";
import { addSeconds } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileProfileRole } from "@/lib/google/role-sync";
import { saveGoogleTokens } from "@/lib/google/oauth-tokens";
import { isWorkspaceEmail } from "@/lib/calendar-eligibility";
import { ROLE } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";

// Google's own access tokens last ~3600s; Supabase doesn't surface the provider's exact
// expiry, so this is a deliberately conservative estimate — a little short is harmless
// (lib/google/calendar.ts just refreshes a bit earlier than strictly necessary), a little
// long risks using a token Google's already rejected.
const ASSUMED_PROVIDER_TOKEN_TTL_SECONDS = 3500;

// Google OAuth is for Google Workspace accounts ONLY. There is deliberately no third category
// of "external user who happens to have a Google account": an admin-created external user
// authenticates with email + password, even when their address is also a Google identity.
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

  // Read through the service role: this runs before the domain decision below, so it has to
  // work even for a session that's about to be rejected and signed out.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .maybeSingle();

  // Supabase links a Google identity onto an existing account with the same confirmed email,
  // so an external user who clicks "Sign in with Google" lands here as their own account.
  // Rejecting the Google path must never destroy that account.
  const isExternalAccount = profile?.role === ROLE.EXTERNAL;

  if (isExternalAccount || !isWorkspaceEmail(user.email)) {
    await supabase.auth.signOut();

    if (profile) {
      // An account an admin deliberately created. Reject the login method, keep the account,
      // and point them at the one that works for them.
      return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=external_account`, url.origin));
    }

    // No profile means exchangeCodeForSession above just created this account moments ago
    // for someone outside the Workspace with no business here. Left alone, that stray
    // profile shows up in every owner/assignee picker — listAssignableProfiles() filters on
    // status, not domain — even though this person can never sign back in. Delete it now;
    // profiles.id has `on delete cascade` (migration 0001) so one call clears both rows.
    await admin.auth.admin.deleteUser(user.id);
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=domain`, url.origin));
  }

  // Deactivation bans the account (management/users/_actions.ts), so Supabase normally refuses
  // to complete the exchange at all. This is the backstop for accounts deactivated before that
  // was true: no session survives this route, rather than one that only fails later at RLS.
  if (profile && profile.status !== "active") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=deactivated`, url.origin));
  }

  // Workspace accounts only from here down, so role resolution from Google Groups always
  // applies. reconcileProfileRole additionally refuses to touch an external profile — see
  // lib/google/role-sync.ts for why that guard has to exist rather than being implied.
  await reconcileProfileRole(user.id, user.email, profile?.role ?? null);

  // TEMPORARY — per-user OAuth token capture for Calendar sync, the dev-friendly stopgap
  // for domain-wide delegation not reaching personal @gmail.com test accounts (see
  // google-button.tsx's scopes comment and lib/google/calendar.ts). Only ever reached by a
  // Workspace account, which is what keeps external users tokenless by construction.
  // provider_token is only present when the sign-in actually requested the calendar.events
  // scope; older sessions re-authenticating without a fresh consent may come back without
  // one, which is fine — saveGoogleTokens is simply skipped that run.
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
