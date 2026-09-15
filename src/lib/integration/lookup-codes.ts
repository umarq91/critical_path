import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type SupabaseClient = ReturnType<typeof createAdminClient>;

// The spec's task-level filters address a season/brand by its stable short `*_code`, not the
// internal uuid a `tasks` row actually stores — `season_code`/`brand_code` are real, unique
// columns (see supabase/schema.md), so this is one indexed lookup, not a fuzzy match. Returns
// `null` for a code that matches nothing, distinct from "no filter given" — callers use that to
// short-circuit to an empty result instead of accidentally running an unfiltered query.
export async function resolveSeasonIdByCode(supabase: SupabaseClient, seasonCode: string): Promise<string | null> {
  const { data, error } = await supabase.from("seasons").select("id").eq("season_code", seasonCode).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function resolveBrandIdByCode(supabase: SupabaseClient, brandCode: string): Promise<string | null> {
  const { data, error } = await supabase.from("brands").select("id").eq("brand_code", brandCode).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
