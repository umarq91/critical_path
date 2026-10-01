import "server-only";
import { createClient } from "@/lib/supabase/server";
import { partyKey, type PartySummary } from "@/lib/party";
import { sanitiseOrSearchTerm } from "@/lib/utils";

export interface SearchPartiesParams {
  query?: string;
}

// Powers the Owners and People Involved pickers on tasks: departments only, plain
// case-insensitive substring match on name. Individual people can't be picked (client decision):
// a department already puts the task on each member's My Tasks page. Tasks that already name a
// person keep them; the write paths only refuse to add new ones (see tasks/schema.ts).
export async function searchParties({ query }: SearchPartiesParams = {}) {
  const supabase = await createClient();
  const term = query ? sanitiseOrSearchTerm(query) : "";

  let departmentQuery = supabase
    .from("departments")
    .select("id, name, is_external")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (term) departmentQuery = departmentQuery.ilike("name", `%${term}%`);

  const { data, error } = await departmentQuery;
  if (error) throw error;

  return (data ?? []).map(
    (row): PartySummary => ({
      kind: "department",
      id: row.id,
      key: partyKey({ kind: "department", id: row.id }),
      name: row.name,
      // Description is create/edit-form-only (department-form.tsx) \u2014 never shown in a picker.
      subtitle: row.is_external ? "External \u00b7 no platform users" : null,
      avatarUrl: null,
      isExternal: row.is_external,
    })
  );
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
