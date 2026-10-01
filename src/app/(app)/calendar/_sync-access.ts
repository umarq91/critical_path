import "server-only";
import { requirePermission } from "@/lib/require-permission";
import { getGoogleOAuthEnv } from "@/lib/env.server";
import { hasGoogleCalendarToken } from "@/lib/google/oauth-tokens";
import { isGoogleCalendarEligible } from "@/lib/calendar-eligibility";

const NOT_CONNECTED_ERROR = "Google Calendar isn't connected yet — sign out and sign back in to grant access.";

// Every Sync step (the plan and each batch) re-checks all of this, since each one is its own
// Server Action request.
export async function requireCalendarSyncAccess() {
  const auth = await requirePermission("calendar.sync_google");
  if (!auth.ok) return auth;

  // Account-level eligibility on top of the capability check: external users have no
  // Workspace Google account at all, so this must never be reachable for them regardless of
  // token state. See lib/calendar-eligibility.ts.
  if (!isGoogleCalendarEligible({ role: auth.role, email: auth.email })) {
    return { ok: false as const, error: "Google Calendar sync is only available for Google Workspace accounts." };
  }

  // TEMPORARY — per-user OAuth (google_oauth_tokens), the dev-friendly stopgap for personal
  // @gmail.com test accounts that domain-wide delegation can't reach. See lib/google/
  // calendar.ts's top comment for the plan to revisit this once real Workspace accounts
  // are in use.
  if (!getGoogleOAuthEnv()) {
    return { ok: false as const, error: "Google Calendar sync isn't configured yet — ask an admin to set it up." };
  }
  if (!(await hasGoogleCalendarToken(auth.userId))) {
    return { ok: false as const, error: NOT_CONNECTED_ERROR };
  }
  return auth;
}

export { NOT_CONNECTED_ERROR };
