import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE, ROLE_LABEL, type Role } from "@/constants/roles";
import { can, type Action } from "@/lib/permissions";

// Fixed, deterministic listing order — roles aren't rows in a table (no natural sort key), so
// this stands in for one. Only needs to be *a* stable order shared across requests for cursor
// paging to make sense, not the same order the UI happens to display roles in elsewhere.
const ROLE_ORDER: readonly Role[] = [ROLE.ADMIN, ROLE.STANDARD_USER, ROLE.VIEWER, ROLE.EXTERNAL];

// Must be kept in sync with the `Action` union in lib/permissions.ts by hand — TypeScript's
// union type has no runtime representation, so there's no way to enumerate it automatically. If
// a new action is added there, it silently won't appear here until this list is updated too.
// `task.edit_due_date_when_locked` is deliberately excluded: it's not a static per-role grant —
// `can()` ignores ROLE_ALLOWED entirely for it and instead checks `!resource?.isLocked`, always
// evaluated alongside `task.update` by real callers — listing it on its own here would present a
// resource-dependent modifier as an unconditional role grant.
const ALL_ACTIONS: readonly Action[] = [
  "profile.update_own",
  "dashboard.view",
  "dashboard.export_reports",
  "task.view",
  "task.create",
  "task.update",
  "task.delete",
  "task.assign",
  "task.bulk_update",
  "task.comment",
  "task.upload_attachment",
  "task.lock",
  "brand.view",
  "brand.manage",
  "brand.delete",
  "lookups.view",
  "calendar.sync_google",
  "admin.manage_users",
  "admin.manage_lookups",
  "admin.view_audit_log",
  "admin.manage_integrations",
];

export interface IntegrationRolePermission {
  permission_key: Action;
  access_level: "full";
}

export interface IntegrationRoleRow {
  role_id: Role;
  role_name: string;
  access_level: "full_access" | null;
  status: "active";
  user_count: number;
  permissions: IntegrationRolePermission[];
}

function encodeRoleCursor(roleId: Role): string {
  return Buffer.from(roleId).toString("base64url");
}

// Forgiving like the shared IntegrationCursor's decodeCursor (lib/integration/cursor.ts) — a
// garbled or hand-edited cursor reads as "start from the beginning," never a 500. Doesn't reuse
// that shared cursor type: it validates its `id` as a UUID and orders on (updated_at, id),
// neither of which exists for a role (roles aren't DB rows and have no updated_at column). This
// is a simpler "resume after this role code, in ROLE_ORDER" scheme sized for the actual,
// permanently-fixed 4-row dataset instead.
function decodeRoleCursor(raw: string | null): Role | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf-8");
    return (ROLE_ORDER as readonly string[]).includes(decoded) ? (decoded as Role) : null;
  } catch {
    return null;
  }
}

export interface ListRolesForIntegrationParams {
  pageSize: number;
  cursor: string | null;
}

// Backs GET /integration/v1/roles. Roles aren't a table — they're the fixed enum in
// constants/roles.ts plus the allow-list matrix in lib/permissions.ts — so every field here
// comes from code, not a query, except user_count. Deviations from the spec's literal shape,
// all consistent with client direction to send real-or-null rather than invent (see
// things-to-know.md's Integrations section):
//   - role_id is the role's code (e.g. "admin"), not a UUID — there's no synthetic row to assign
//     one to, and fabricating one that looks like a database id would misrepresent this as
//     backed by a table.
//   - access_level (role-level) is "full_access" ONLY when a role's permissions cover every
//     entry in ALL_ACTIONS — true for admin, verifiably, since can(ADMIN, x) is true for every
//     x. Null for the other three roles: the spec names no other tier, and inventing one (e.g.
//     "partial_access") would be guessing at a taxonomy nobody's confirmed.
//   - access_level (per-permission, inside the `permissions` array) is always "full": can() is a
//     boolean allow/deny, not graded, so every permission_key present in a role's list is, by
//     definition, granted in full — not a gap, a provably accurate constant.
//   - status is always "active" — not derived, just true by construction: a role either exists
//     in the ROLE enum or it doesn't. There's no deactivation concept the way profiles.status
//     has one for users.
//   - updated_at/deleted_at/version are always null — nothing tracks "when did this role's
//     permission set last change" (that's git history, not a column), and roles are never
//     deleted, only ever added in code. updated_since/include_deleted are accepted (the spec
//     lists them) but are no-ops for the same reason: nothing here has a timestamp or a deleted
//     state to filter on.
export async function listRolesForIntegration({
  pageSize,
  cursor,
}: ListRolesForIntegrationParams): Promise<{ rows: IntegrationRoleRow[]; nextCursor: string | null }> {
  const supabase = createAdminClient();

  // Not filtered by status — deactivated users still count, same as /teams' member_count not
  // filtering on status either. This is "how many accounts hold this role," not "how many are
  // currently able to use it."
  const { data, error } = await supabase.from("profiles").select("role");
  if (error) throw error;

  const userCounts = new Map<string, number>();
  for (const row of data ?? []) {
    userCounts.set(row.role, (userCounts.get(row.role) ?? 0) + 1);
  }

  const startAfter = decodeRoleCursor(cursor);
  const startIndex = startAfter ? ROLE_ORDER.indexOf(startAfter) + 1 : 0;
  const slice = ROLE_ORDER.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < ROLE_ORDER.length;

  const rows: IntegrationRoleRow[] = slice.map((role) => {
    const permissions = ALL_ACTIONS.filter((action) => can(role, action)).map((action) => ({
      permission_key: action,
      access_level: "full" as const,
    }));
    return {
      role_id: role,
      role_name: ROLE_LABEL[role],
      access_level: permissions.length === ALL_ACTIONS.length ? "full_access" : null,
      status: "active",
      user_count: userCounts.get(role) ?? 0,
      permissions,
    };
  });

  const last = slice[slice.length - 1];
  const nextCursor = hasMore && last ? encodeRoleCursor(last) : null;

  return { rows, nextCursor };
}
