import "server-only";
import { createClient } from "@/lib/supabase/server";
import { partyKey, type PartySummary } from "@/lib/party";
import { sanitiseOrSearchTerm } from "@/lib/utils";

export interface SearchPartiesParams {
  query?: string;
}

// One page of results, no "load more". Past this many matches the answer is "type a bit more",
// not another round trip — the picker exists to find a known department or person, not to
// browse the directory.
const SEARCH_RESULT_LIMIT = 50;

// Powers the Owners and People Involved pickers on tasks. Plain case-insensitive substring
// match — departments on name, people on name or email.
//
// Departments come first and are never truncated: there are ~18 of them against a profiles
// table that can grow, and they're the primary way work is assigned (the client's export names
// a department as owner on 832 of 833 rows). Already-picked parties are filtered out on the
// client, which is where that state lives — keeping it out of the query.
export async function searchParties({ query }: SearchPartiesParams = {}) {
  const supabase = await createClient();
  const term = query ? sanitiseOrSearchTerm(query) : "";

  let departmentQuery = supabase
    .from("departments")
    .select("id, name, description, is_external")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (term) departmentQuery = departmentQuery.ilike("name", `%${term}%`);

  let profileQuery = supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, department:departments(name)")
    .eq("status", "active")
    .order("full_name", { ascending: true })
    // One past the limit, so "there are more" is known without a second count query.
    .limit(SEARCH_RESULT_LIMIT + 1);
  if (term) profileQuery = profileQuery.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

  const [departments, profiles] = await Promise.all([departmentQuery, profileQuery]);
  if (departments.error) throw departments.error;
  if (profiles.error) throw profiles.error;

  const departmentRows: PartySummary[] = (departments.data ?? []).map((row) => ({
    kind: "department" as const,
    id: row.id,
    key: partyKey({ kind: "department", id: row.id }),
    name: row.name,
    subtitle: row.is_external ? "External \u00b7 no platform users" : row.description,
    avatarUrl: null,
    isExternal: row.is_external,
  }));

  const profileRows = profiles.data ?? [];
  const peopleRows: PartySummary[] = profileRows.slice(0, SEARCH_RESULT_LIMIT).map((row) => ({
    kind: "user" as const,
    id: row.id,
    key: partyKey({ kind: "user", id: row.id }),
    name: row.full_name ?? row.email,
    subtitle: row.department ? `${row.email} \u00b7 ${row.department.name}` : row.email,
    avatarUrl: row.avatar_url,
    isExternal: false,
  }));

  return { data: [...departmentRows, ...peopleRows], truncated: profileRows.length > SEARCH_RESULT_LIMIT };
}

// Flat `{ value: "kind:uuid", label }` options for the grid's Owner filter dropdown, which is
// a plain select rather than the paginated search the form uses. Departments first, matching
// searchParties' ordering. Its own query, not derived from a page of tasks — filter options
// have to cover the whole dataset, not just the current page.
export async function listPartyOptions() {
  const supabase = await createClient();
  const [departments, profiles] = await Promise.all([
    supabase.from("departments").select("id, name").is("deleted_at", null).order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
  ]);

  if (departments.error) throw departments.error;
  if (profiles.error) throw profiles.error;

  return [
    ...(departments.data ?? []).map((row) => ({
      value: partyKey({ kind: "department", id: row.id }),
      label: row.name,
    })),
    ...(profiles.data ?? []).map((row) => ({
      value: partyKey({ kind: "user", id: row.id }),
      label: row.full_name ?? row.email,
    })),
  ];
}
