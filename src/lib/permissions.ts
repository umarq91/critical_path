import { ROLE, type Role } from "@/constants/roles";

// Single capability matrix — imported by Server Actions (enforcement) and by the UI
// (disable/hide). RLS mirrors these same rules server-side as defense in depth; when this
// matrix changes, update the matching migration in the same PR.
//
// Source: client's Role-Based Access screen (Administrator / Standard User / Viewer), plus
// `external` (0017/0018) for people who use the platform but are not in the client's Google
// Workspace. Lookup entities without their own row on that screen yet (seasons, key stages,
// templates, holidays, leave, reminder rules) fall under admin.manage_lookups until the
// client gives us a granular matrix for them the way they did for Brands.
export type Action =
  | "profile.update_own"
  | "dashboard.view"
  | "dashboard.export_reports"
  | "task.view"
  | "task.create"
  | "task.update"
  | "task.delete"
  | "task.assign"
  | "task.bulk_update"
  | "task.comment"
  | "task.upload_attachment"
  | "task.lock"
  | "task.edit_due_date_when_locked"
  | "brand.view"
  | "brand.manage"
  | "brand.delete"
  | "lookups.view"
  | "calendar.sync_google"
  | "admin.manage_users"
  | "admin.manage_lookups"
  // Reading the audit log is its own capability, not part of admin.manage_users: it spans
  // every entity and every actor in the organisation, so granting it should be a deliberate
  // decision rather than something that rides along with editing a user's department.
  | "admin.view_audit_log"
  // Same reasoning as admin.view_audit_log, one step further: a leaked API key isn't a record
  // of what already happened, it's a standing credential for whatever the integration API
  // exposes going forward. Its own action, not folded into admin.manage_users.
  | "admin.manage_integrations";

const STANDARD_USER_ALLOWED: ReadonlySet<Action> = new Set<Action>([
  "profile.update_own",
  "dashboard.view",
  "dashboard.export_reports",
  "task.view",
  "task.create",
  "task.update",
  "task.assign",
  "task.comment",
  "task.upload_attachment",
  "lookups.view",
  "calendar.sync_google",
]);

const VIEWER_ALLOWED: ReadonlySet<Action> = new Set<Action>([
  "profile.update_own",
  "dashboard.view",
  "task.view",
  "lookups.view",
  "calendar.sync_google",
]);

// Written out in full rather than derived from VIEWER_ALLOWED. External is NOT "a viewer with
// a smaller row set" — the two differ in kind, and expressing one as a subset of the other
// invites a future grant to viewer from silently reaching people outside the company.
//
// What external gets: their own tasks (RLS in 0018 scopes every task read to tasks they
// participate in), the calendar and dashboard rendered from that same scoped set, and their
// own profile. Nothing else.
//
// What it deliberately excludes and why:
//   - every task.* write — external users are collaborators the client tracks work against,
//     not editors of the client's critical path. If the client later wants them to update
//     status on their own tasks, that is one entry added here plus an RLS write policy
//     scoped by task_involves_current_user(); it is not a default.
//   - brand.view / lookups.view — those pages are whole-organisation lists (every brand,
//     season, key stage, department). Individual lookup names still resolve through their
//     own tables so an external user's task rows render with a season/brand label.
//   - dashboard.export_reports — exports leave the platform's scoping behind.
//   - calendar.sync_google — an external user has no Workspace Google account by definition.
//     See lib/calendar-eligibility.ts, which layers a domain check on top of this.
const EXTERNAL_ALLOWED: ReadonlySet<Action> = new Set<Action>([
  "profile.update_own",
  "dashboard.view",
  "task.view",
]);

const ROLE_ALLOWED: Record<Role, ReadonlySet<Action>> = {
  [ROLE.ADMIN]: new Set<Action>(),
  [ROLE.STANDARD_USER]: STANDARD_USER_ALLOWED,
  [ROLE.VIEWER]: VIEWER_ALLOWED,
  [ROLE.EXTERNAL]: EXTERNAL_ALLOWED,
};

export function can(role: Role, action: Action, resource?: { isLocked?: boolean }): boolean {
  if (role === ROLE.ADMIN) return true;

  // Locked tasks block due-date edits for everyone below admin, layered on top of the
  // general task.update grant — checked by callers alongside can(role, "task.update").
  // Unlocked tasks fall through to that general grant instead; this action only matters
  // once resource.isLocked is true, at which point admin (already returned above) is the
  // only role that may still move the due date.
  if (action === "task.edit_due_date_when_locked") return !resource?.isLocked;

  return ROLE_ALLOWED[role]?.has(action) ?? false;
}

export function isAdmin(role: Role): boolean {
  return role === ROLE.ADMIN;
}
