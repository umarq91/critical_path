import "server-only";
import { createClient } from "@/lib/supabase/server";
import { can, type Action } from "@/lib/permissions";

// The one place every Server Action goes through to enforce a permission — auth.getUser() +
// profile fetch + can() should never be re-implemented per entity's _actions.ts. Kept out of
// lib/permissions.ts itself: that file must stay a pure, server-independent rules module so
// can()/isAdmin() can still be imported from a Client Component for UI disable/hide, which a
// top-level createClient() import here would break (server-only poisons the whole module).
//
// Returns the created client + user id on success so callers reuse one client for the rest
// of the action instead of creating a second one.
export async function requirePermission(action: Action, resource?: { isLocked?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !can(profile.role, action, resource)) {
    return { ok: false as const, error: "You don't have permission to do this" };
  }

  return { ok: true as const, supabase, userId: user.id, role: profile.role };
}
