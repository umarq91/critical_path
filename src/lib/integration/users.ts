import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeCursor, type IntegrationCursor } from "@/lib/integration/cursor";
import { ROLE_LABEL } from "@/constants/roles";

export interface ListUsersForIntegrationParams {
  pageSize: number;
  cursor: IntegrationCursor | null;
  updatedSince: string | null;
}

const USER_SELECT = "id, email, full_name, role, status, updated_at, department:departments(name)";

export interface IntegrationUserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  updated_at: string;
  department: { name: string } | null;
}

// Backs GET /integration/v1/users. Two gaps the spec wants that this schema genuinely has no
// answer for — both sent as `null`, not derived from something adjacent that would misrepresent
// them:
//   - `last_active_at`: no last-sign-in tracking exists on `profiles` at all.
//   - `deleted_at`: users are never soft- or hard-deleted, only deactivated via `status`
//     (`active`/`inactive`) — `deleted_at` would misrepresent a deactivation as a deletion, so
//     it stays null rather than being derived from `status !== 'active'`.
// `role_name` DOES have real data behind it — `ROLE_LABEL` (constants/roles.ts) is the same
// map the UI's role badges use, reused here rather than re-deriving "Administrator" from
// "admin" a second time.
export async function listUsersForIntegration({
  pageSize,
  cursor,
  updatedSince,
}: ListUsersForIntegrationParams): Promise<{ rows: IntegrationUserRow[]; nextCursor: string | null }> {
  const supabase = createAdminClient();

  let query = supabase.from("profiles").select(USER_SELECT);
  if (updatedSince) query = query.gte("updated_at", updatedSince);

  // Keyset pagination — see lib/integration/cursor.ts for why (updated_at, id) and why the
  // cursor is validated before it ever reaches this string.
  if (cursor) {
    query = query.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize + 1);
  if (error) throw error;

  const rows = (data ?? []) as unknown as IntegrationUserRow[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null;

  return { rows: page, nextCursor };
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role;
}
