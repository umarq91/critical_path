import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
  sortBy: string | null;
  sortDir: string | null;
}

// The Tasks grid's saved filter/sort presets — one row per (profile, name), in the exact
// {filters, sortBy, sortDir} shape data-table-search-params.ts already owns, so applying one is
// a plain navigation (dataTableSearchParamsHref) with no translation step. RLS already scopes
// `saved_views` to `profile_id = auth.uid()`; the explicit .eq() here matches every other
// per-profile read in this codebase (see data/reminders.ts) rather than relying on RLS alone.
export async function listSavedViews(profileId: string): Promise<SavedView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .select("id, name, filters, sort_by, sort_dir")
    .eq("profile_id", profileId)
    .order("name", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    filters: (row.filters as Record<string, string> | null) ?? {},
    sortBy: row.sort_by,
    sortDir: row.sort_dir,
  }));
}
