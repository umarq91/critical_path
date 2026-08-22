import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// cache() memoizes per-request — (app)/layout.tsx calls this for the auth guard/UserMenu,
// and individual pages call it again for role checks (e.g. seasons/page.tsx's
// canCreateSeason). Without this, that's two auth.getUser() + profile SELECT round trips
// for the same data on every request.
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, department_id, status, created_at")
    .eq("id", user.id)
    .single();

  return profile;
});

// Options for pickers that assign another entity to a person (e.g. the task form's
// Owner/Assignee select, the task grid's Owner filter) — every active profile, not just
// people already assigned to something.
export async function listAssignableProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("status", "active")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface SearchProfilesParams {
  query?: string;
  excludeIds?: string[];
  page?: number;
  pageSize?: number;
}

const SEARCH_PROFILES_DEFAULT_PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PostgREST's `.or()` filter string uses commas to separate conditions and parentheses for
// grouping — a raw search term containing either would corrupt the filter syntax (or smuggle
// an extra condition in), so strip them before building the OR clause.
function sanitiseOrSearchTerm(value: string) {
  return value.replace(/[,()]/g, "").trim();
}

// Powers the "People Involved" search-and-add UI (tasks/people-search-dropdown.tsx) — the
// member list can run into the thousands, so this is deliberately paginated and searched
// server-side rather than reusing listAssignableProfiles' load-everything shape.
//
// Plain substring matching — a straight `%term%` on the indexed columns already covers "an
// exact full name" and "a fragment of it, like 'um' for 'Umar'". Keep this simple unless a
// real need for fuzzier matching (typo tolerance, reordered words) comes back; that would
// call for a word-split + pg_trgm approach, which needs careful indexing to stay fast.
export async function searchProfiles({
  query,
  excludeIds = [],
  page = 1,
  pageSize = SEARCH_PROFILES_DEFAULT_PAGE_SIZE,
}: SearchProfilesParams = {}) {
  const supabase = await createClient();
  let dbQuery = supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, department:departments(name)")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  const term = query ? sanitiseOrSearchTerm(query) : "";
  if (term) dbQuery = dbQuery.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

  const safeExcludeIds = excludeIds.filter((id) => UUID_PATTERN.test(id));
  if (safeExcludeIds.length) dbQuery = dbQuery.not("id", "in", `(${safeExcludeIds.join(",")})`);

  const from = (page - 1) * pageSize;
  // Fetch one extra row past the page boundary — cheap way to know whether "Load more"
  // should show without a separate count(*) query on every keystroke.
  const { data, error } = await dbQuery.range(from, from + pageSize);
  if (error) throw error;

  const rows = data ?? [];
  return { data: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export type SearchedProfile = Awaited<ReturnType<typeof searchProfiles>>["data"][number];
