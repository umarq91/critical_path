import "server-only";
import { createClient } from "@/lib/supabase/server";

// Everything a task-import row's names are matched against, loaded once per upload rather than
// once per row. Same visibility rules as the Add Task form's pickers: live seasons, live+active
// brands, live key stages and departments, active people — so a sheet can't attach a task to
// something the form itself wouldn't offer.
export async function loadTaskImportLookups() {
  const supabase = await createClient();
  const [seasons, brands, keyStages, departments, profiles] = await Promise.all([
    supabase.from("seasons").select("id, season:season_code").is("deleted_at", null),
    supabase.from("brands").select("id, brand_name").is("deleted_at", null).eq("status", "active"),
    supabase.from("key_stages").select("id, name").is("deleted_at", null),
    supabase.from("departments").select("id, name").is("deleted_at", null),
    supabase.from("profiles").select("id, full_name, email").eq("status", "active"),
  ]);

  for (const result of [seasons, brands, keyStages, departments, profiles]) {
    if (result.error) throw result.error;
  }

  return {
    seasons: seasons.data ?? [],
    brands: brands.data ?? [],
    keyStages: keyStages.data ?? [],
    departments: departments.data ?? [],
    profiles: profiles.data ?? [],
  };
}

export type TaskImportLookups = Awaited<ReturnType<typeof loadTaskImportLookups>>;
