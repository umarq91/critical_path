"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { departmentSchema, departmentUpdateSchema } from "@/app/(app)/management/teams/schema";
import { listDepartmentMembers } from "@/data/departments";
import { searchProfiles, type SearchProfilesParams } from "@/data/profiles";

export async function createDepartment(input: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await auth.supabase.from("departments").insert(parsed.data).select().single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/management/teams");
  return { ok: true as const, data };
}

export async function updateDepartment(id: string, patch: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = departmentUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase.from("departments").update(parsed.data).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/management/teams");
  return { ok: true as const };
}

export async function deleteDepartment(id: string) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("departments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/management/teams");
  return { ok: true as const };
}

// --- Membership ---------------------------------------------------------------------------
//
// A profile carries a single `department_id` (0009), so membership is a column on the person,
// not a join table. Two consequences that shape every action below:
//   1. Adding someone who is already in another department MOVES them — it is not an
//      additional membership. The dialog says so before the click.
//   2. "Remove from department" just nulls the column; it never touches the account itself.
//
// Gated on admin.manage_users rather than admin.manage_lookups: this edits user records, and
// `profiles.department_id` is one of the columns the guard trigger (0001/0009) restricts to
// admins anyway, so a lookup-only permission would be rejected by the database regardless.

export async function listTeamMembers(departmentId: string) {
  const auth = await requirePermission("admin.manage_users");
  if (!auth.ok) return auth;

  return { ok: true as const, data: await listDepartmentMembers(departmentId) };
}

// Candidates to add. Deliberately returns people who already belong to another department —
// moving someone between teams is a normal operation, and hiding them would look like the
// search was broken. The UI labels their current department so the move is never a surprise.
export async function searchTeamCandidates(params: SearchProfilesParams) {
  const auth = await requirePermission("admin.manage_users");
  if (!auth.ok) return auth;

  const result = await searchProfiles(params);
  return { ok: true as const, data: result.data, hasMore: result.hasMore };
}

export async function addTeamMember(departmentId: string, profileId: string) {
  const auth = await requirePermission("admin.manage_users");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("profiles")
    .update({ department_id: departmentId })
    .eq("id", profileId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/management/teams");
  revalidatePath("/management/users");
  return { ok: true as const };
}

export async function removeTeamMember(departmentId: string, profileId: string) {
  const auth = await requirePermission("admin.manage_users");
  if (!auth.ok) return auth;

  // Scoped to the department the dialog was opened from, so a stale dialog can't clear the
  // department of someone who has since been moved elsewhere.
  const { error } = await auth.supabase
    .from("profiles")
    .update({ department_id: null })
    .eq("id", profileId)
    .eq("department_id", departmentId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/management/teams");
  revalidatePath("/management/users");
  return { ok: true as const };
}
