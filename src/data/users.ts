import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ROLE, type Role } from "@/constants/roles";

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["full_name", "email", "role", "status", "created_at"]);

const USER_SELECT = "id, email, full_name, avatar_url, role, status, department_id, created_at, department:departments(id, name)";

// PostgREST's `.or()` filter string uses commas to separate conditions and parentheses for
// grouping — a raw search term containing either would corrupt the filter syntax (or smuggle
// an extra condition in), so strip them before building the OR clause. Same guard as
// data/profiles.ts's searchProfiles.
function sanitiseOrSearchTerm(value: string) {
  return value.replace(/[,()]/g, "").trim();
}

// The `role` filter arrives as a raw search param, so it has to be narrowed to the enum
// before it reaches the query — an unrecognised value is dropped rather than passed through
// to Postgres as an invalid enum literal.
const ROLE_VALUES = Object.values(ROLE) as readonly string[];

function isRole(value: string | undefined): value is Role {
  return !!value && ROLE_VALUES.includes(value);
}

// The Management → Users list. Server-paginated like every other DataTable-backed list; the
// `accountType` filter is a presentation of `role` (external vs the three Workspace roles)
// rather than a column of its own, because role IS the account type — see constants/roles.ts.
export async function listUsers({
  page = 1,
  pageSize = 15,
  sortBy,
  sortDir,
  filters = {},
}: ListUsersParams = {}) {
  const supabase = await createClient();
  let query = supabase.from("profiles").select(USER_SELECT, { count: "exact" });

  const term = filters.full_name ? sanitiseOrSearchTerm(filters.full_name) : "";
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  if (isRole(filters.role)) query = query.eq("role", filters.role);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.accountType === "external") query = query.eq("role", ROLE.EXTERNAL);
  if (filters.accountType === "workspace") query = query.neq("role", ROLE.EXTERNAL);

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "full_name";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type ManagedUser = Awaited<ReturnType<typeof listUsers>>["data"][number];

export interface UserSummary {
  total: number;
  workspace: number;
  external: number;
  inactive: number;
}

// Its own narrow query, never derived from a page of listUsers() — a stat card counts the
// whole table, not the fifteen rows currently on screen.
export async function getUserSummary(): Promise<UserSummary> {
  const supabase = await createClient();

  const [total, external, inactive] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", ROLE.EXTERNAL),
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("status", "active"),
  ]);

  const totalCount = total.count ?? 0;
  const externalCount = external.count ?? 0;

  return {
    total: totalCount,
    workspace: totalCount - externalCount,
    external: externalCount,
    inactive: inactive.count ?? 0,
  };
}
