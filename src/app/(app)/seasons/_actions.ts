"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { seasonSchema, seasonUpdateSchema } from "@/app/(app)/seasons/schema";

export async function createSeason(input: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // The app keeps one value per season, stored in `season_code`. `season_name` is still a
  // NOT NULL column only because the integration API returns it, so it mirrors the same value.
  // Seasons no longer carry dates in the app; the columns are always written as null.
  const { season, ...rest } = parsed.data;
  const { data, error } = await auth.supabase
    .from("seasons")
    .insert({ ...rest, season_code: season, season_name: season, start_date: null, end_date: null })
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

  const { season, ...rest } = parsed.data;
  const { error } = await auth.supabase
    .from("seasons")
    .update(season === undefined ? rest : { ...rest, season_code: season })
    .eq("id", id);
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
