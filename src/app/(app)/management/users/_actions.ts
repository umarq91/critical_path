"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWorkspaceEmail } from "@/lib/calendar-eligibility";
import { ROLE } from "@/constants/roles";
import {
  externalUserSchema,
  setPasswordSchema,
  userUpdateSchema,
} from "@/app/(app)/management/users/schema";

function normaliseDepartmentId(value: string | null | undefined): string | null {
  return value && value !== "none" ? value : null;
}

// Supabase expresses a ban as a Go duration string; there is no "forever", so this is a
// hundred years. "none" lifts it. Deactivating bans the account so Supabase Auth refuses to
// issue a token at all — status alone can't do that, because Auth knows nothing about our
// profiles table.
const PERMANENT_BAN_DURATION = "876000h";
const NO_BAN = "none";

// Creating an auth identity is the one operation with no per-user equivalent — supabase-js
// exposes it only on the service-role admin API, so this is a deliberate, documented
// exception to "no service-role client inside a Server Action" (CLAUDE.md). It is gated on
// admin.manage_users first, and every field it writes is validated above.
//
// The password goes straight to Supabase Auth, which stores its own hash. It is never
// written to, logged by, or returned from any table of ours.
export async function createExternalUser(input: unknown) {
  const auth = await requirePermission("admin.manage_users");
  if (!auth.ok) return auth;

  const parsed = externalUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { email, full_name, password, department_id } = parsed.data;

  // A Workspace address belongs to a Workspace account, which signs in through Google. Giving
  // one a password here would create a second credential for the same person and an account
  // whose sign-in method contradicts its email — see auth/callback/route.ts.
  if (isWorkspaceEmail(email)) {
    return {
      ok: false as const,
      error: "That address is on the company Google Workspace — they sign in with Google, not a password.",
    };
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    // No confirmation email exists to click: an admin is vouching for this address directly,
    // and there is deliberately no invitation flow.
    email_confirm: true,
    // Read by the handle_new_user trigger (0018), so the profile row is born as `external`
    // instead of spending a moment as the `viewer` default. Only 'external' is honoured
    // there — the hint can lower privilege, never raise it.
    user_metadata: { full_name, app_role: ROLE.EXTERNAL },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? "Could not create this user";
    // Supabase reports a duplicate as a 422; surfacing it plainly is fine here because only
    // an admin can reach this action, so there's no enumeration concern.
    return { ok: false as const, error: message };
  }

  // Belt and braces over the metadata hint above: this action is the authority on what an
  // externally created account is, and it must not depend on a database trigger having been
  // migrated to the right version to get the role right.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: ROLE.EXTERNAL, full_name, department_id: normaliseDepartmentId(department_id) })
    .eq("id", created.user.id);

  if (profileError) {
    // The auth user exists but its profile is wrong, which is worse than no account at all —
    // it would be an account of indeterminate role. Remove it and report the failure.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false as const, error: profileError.message };
  }

  revalidatePath("/management/users");
  return { ok: true as const, data: { id: created.user.id } };
}

// Every sensitive change to an existing account. Role and status are admin-only columns at
// the database level too (the profiles guard trigger, 0001/0009), so a forged client request
// that skipped this action would still be rejected — this is the layer that produces a
// sensible error instead of a constraint violation.
export async function updateUser(userId: string, patch: unknown) {
  const auth = await requirePermission("admin.manage_users");
  if (!auth.ok) return auth;

  const parsed = userUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data: target } = await auth.supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", userId)
    .single();
  if (!target) return { ok: false as const, error: "That user no longer exists" };

  // An admin removing their own admin rights or deactivating themselves can lock the whole
  // organisation out of user management, since only an admin can undo it.
  if (userId === auth.userId && (parsed.data.role || parsed.data.status)) {
    return { ok: false as const, error: "You can't change your own role or status" };
  }

  // Account type is fixed at creation. An external account authenticates with a password and
  // has no Workspace identity; promoting it to a Workspace role would leave a password-holder
  // with internal access, and demoting a Workspace user to `external` would leave them with
  // no way to sign in at all. userUpdateSchema already excludes `external` from the accepted
  // values — this rejects the other direction, which the schema can't express.
  if (parsed.data.role && target.role === ROLE.EXTERNAL) {
    return {
      ok: false as const,
      error: "An external user's role can't be changed. Create a Workspace account for them instead.",
    };
  }

  const updateData = {
    ...parsed.data,
    ...("department_id" in parsed.data ? { department_id: normaliseDepartmentId(parsed.data.department_id) } : {}),
  };

  const { error } = await auth.supabase.from("profiles").update(updateData).eq("id", userId);
  if (error) return { ok: false as const, error: error.message };

  // Sign-in is blocked at the auth layer, not just the app layer. profiles.status is ours;
  // Supabase Auth has never heard of it, so without this a deactivated user still gets a
  // valid session and is only stopped afterwards by RLS. Banning makes the token request
  // itself fail.
  //
  // Rolled back if it doesn't take: a profile that says "inactive" while the account can
  // still sign in is the exact inconsistency this is meant to remove, so failing loudly
  // beats leaving the two halves disagreeing.
  if (parsed.data.status && parsed.data.status !== target.status) {
    const admin = createAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: parsed.data.status === "inactive" ? PERMANENT_BAN_DURATION : NO_BAN,
    });
    if (banError) {
      await auth.supabase.from("profiles").update({ status: target.status }).eq("id", userId);
      return { ok: false as const, error: `Could not update sign-in access: ${banError.message}` };
    }
  }

  revalidatePath("/management/users");
  revalidatePath("/management/teams");
  return { ok: true as const };
}

// Deactivation is a real revocation at four layers: updateUser bans the account so Supabase
// Auth won't issue a token, both sign-in routes refuse it, is_active_user() (0018) gates every
// task/participant/profile policy, and requirePermission() refuses every Server Action. A
// session that was already open keeps its unexpired access token but can read and write
// nothing, and (app)/layout.tsx shows a deactivated notice instead of the app.
export async function setUserStatus(userId: string, status: "active" | "inactive") {
  return updateUser(userId, { status });
}

export async function setExternalUserPassword(userId: string, input: unknown) {
  const auth = await requirePermission("admin.manage_users");
  if (!auth.ok) return auth;

  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data: target } = await auth.supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();
  if (!target) return { ok: false as const, error: "That user no longer exists" };

  // Workspace accounts have no password by design — their credential lives with Google.
  // Setting one would create a second way into an account that's meant to have exactly one.
  if (target.role !== ROLE.EXTERNAL) {
    return { ok: false as const, error: "Workspace users sign in with Google and don't have a password." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: parsed.data.password });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}
