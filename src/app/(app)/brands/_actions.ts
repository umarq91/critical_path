"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { brandSchema, brandUpdateSchema } from "@/app/(app)/brands/schema";
import { listBrands, type ListBrandsParams } from "@/data/brands";

// Powers the isolated "Refresh" icon on the brands table (see useRefreshableData) — a plain
// read, not a mutation. router.refresh() can't scope a reload to just one section (it
// re-fetches every Server Component on the route), so a Server Action is the escape hatch:
// re-runs the exact same query the page loaded with.
export async function refreshBrands(params: ListBrandsParams) {
  return listBrands(params);
}

export async function createBrand(input: unknown) {
  const auth = await requirePermission("brand.manage");
  if (!auth.ok) return auth;

  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { season_ids, ...brandFields } = parsed.data;
  const { data, error } = await auth.supabase.from("brands").insert(brandFields).select().single();
  if (error) return { ok: false as const, error: error.message };

  const { error: seasonsError } = await auth.supabase
    .from("brand_seasons")
    .insert(season_ids.map((season_id) => ({ brand_id: data.id, season_id })));
  if (seasonsError) return { ok: false as const, error: seasonsError.message };

  revalidatePath("/brands");
  return { ok: true as const, data };
}

export async function updateBrand(id: string, patch: unknown) {
  const auth = await requirePermission("brand.manage");
  if (!auth.ok) return auth;

  const parsed = brandUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { season_ids, ...brandFields } = parsed.data;

  if (Object.keys(brandFields).length > 0) {
    const { error } = await auth.supabase.from("brands").update(brandFields).eq("id", id);
    if (error) return { ok: false as const, error: error.message };
  }

  if (season_ids) {
    // Replace the full set rather than diffing add/remove — simpler, and this is a
    // low-frequency admin edit, not a hot write path.
    const { error: deleteError } = await auth.supabase.from("brand_seasons").delete().eq("brand_id", id);
    if (deleteError) return { ok: false as const, error: deleteError.message };

    if (season_ids.length > 0) {
      const { error: insertError } = await auth.supabase
        .from("brand_seasons")
        .insert(season_ids.map((season_id) => ({ brand_id: id, season_id })));
      if (insertError) return { ok: false as const, error: insertError.message };
    }
  }

  revalidatePath("/brands");
  return { ok: true as const };
}

export async function deleteBrand(id: string) {
  const auth = await requirePermission("brand.delete");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("brands").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/brands");
  return { ok: true as const };
}
