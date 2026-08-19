"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { departmentSchema, departmentUpdateSchema } from "@/app/(app)/departments/schema";

export async function createDepartment(input: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await auth.supabase.from("departments").insert(parsed.data).select().single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/departments");
  return { ok: true as const, data };
}

export async function updateDepartment(id: string, patch: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = departmentUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase.from("departments").update(parsed.data).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/departments");
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

  revalidatePath("/departments");
  return { ok: true as const };
}
