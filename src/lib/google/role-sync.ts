import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserRole } from "@/lib/google/admin-directory";
import { ROLE, type Role } from "@/constants/roles";

// The ONE place a profile's role is reconciled against Google Groups. Called from the OAuth
// callback today; the nightly group-sync cron must call this too when it lands, rather than
// calling resolveUserRole() directly.
//
// External users are platform-managed, not Workspace-managed, and MUST be skipped. This is
// not a nicety: resolveUserRole() returns 'viewer' — not null — for an account that belongs
// to no Google Group, and an admin-created external user belongs to no group by definition.
// Reconciling them would therefore silently promote every external user to 'viewer', which
// under 0018's RLS means read access to the entire organisation's tasks and staff directory.
//
// Returns the role now in force, so callers don't have to re-read the profile.
export async function reconcileProfileRole(
  profileId: string,
  email: string,
  currentRole: Role | null
): Promise<Role | null> {
  if (currentRole === ROLE.EXTERNAL) return currentRole;

  const resolvedRole = await resolveUserRole(email);
  if (!resolvedRole || resolvedRole === currentRole) return currentRole;

  // Service-role write, deliberately bypassing the self-role-change guard on `profiles`
  // (see migration 0001) — a brand-new user is very often not an admin yet, which is
  // exactly why their role needs to come from an authoritative external source (Google
  // Groups) instead of the profiles row they don't get to edit themselves.
  const admin = createAdminClient();
  await admin.from("profiles").update({ role: resolvedRole }).eq("id", profileId);
  return resolvedRole;
}
