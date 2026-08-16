"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { seasonSchema, seasonUpdateSchema } from "@/app/(app)/seasons/schema";

async function requireSeasonManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !can(profile.role, "admin.manage_lookups")) {
    return { ok: false as const, error: "Only an admin can manage seasons" };
  }

  return { ok: true as const, userId: user.id };
}

export async function createSeason(input: unknown) {
  const supabase = await createClient();
  const auth = await requireSeasonManager(supabase);
  if (!auth.ok) return auth;

  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await supabase
    .from("seasons")
    .insert({ ...parsed.data, owner_id: auth.userId })
    .select()
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seasons");
  return { ok: true as const, data };
}

export async function updateSeason(id: string, patch: unknown) {
  const supabase = await createClient();
  const auth = await requireSeasonManager(supabase);
  if (!auth.ok) return auth;

  const parsed = seasonUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await supabase.from("seasons").update(parsed.data).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seasons");
  return { ok: true as const };
}

export async function deleteSeason(id: string) {
  const supabase = await createClient();
  const auth = await requireSeasonManager(supabase);
  if (!auth.ok) return auth;

  // Soft delete — listSeasons() filters deleted_at is null, matching the schema's
  // Databricks-spec-aligned soft-delete convention.
  const { error } = await supabase.from("seasons").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seasons");
  return { ok: true as const };
}
