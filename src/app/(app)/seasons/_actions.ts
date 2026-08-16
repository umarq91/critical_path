"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { seasonSchema, seasonUpdateSchema } from "@/app/(app)/seasons/schema";

export async function createSeason(input: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await auth.supabase
    .from("seasons")
    .insert({ ...parsed.data, owner_id: auth.userId })
    .select()
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seasons");
  return { ok: true as const, data };
}

export async function updateSeason(id: string, patch: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = seasonUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase.from("seasons").update(parsed.data).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seasons");
  return { ok: true as const };
}

export async function deleteSeason(id: string) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  // Soft delete — listSeasons() filters deleted_at is null, matching the schema's
  // Databricks-spec-aligned soft-delete convention.
  const { error } = await auth.supabase.from("seasons").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seasons");
  return { ok: true as const };
}
