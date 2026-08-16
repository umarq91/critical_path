import { ROLE, type Role } from "@/constants/roles";

// Single capability matrix — imported by Server Actions (enforcement) and by the UI
// (disable/hide). RLS mirrors these same rules server-side as defense in depth; when this
// matrix changes, update the matching migration in the same PR.
//
// Source: client's Role-Based Access screen (Administrator / Standard User / Viewer).
// Calendar's create/edit/delete-event actions are intentionally the same actions as their
// task.* counterparts — calendar events are a synced view of task due dates
// (lib/google/calendar.ts), not a separately managed entity, so there's nothing calendar-
// specific to gate. Lookup entities without their own row on that screen yet (seasons, key
// stages, templates, holidays, leave, reminder rules) fall under admin.manage_lookups until
// the client gives us a granular matrix for them the way they did for Brands.
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
  | "admin.manage_users"
  | "admin.manage_lookups";

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
  "brand.view",
]);

const VIEWER_ALLOWED: ReadonlySet<Action> = new Set<Action>([
  "profile.update_own",
  "dashboard.view",
  "task.view",
  "brand.view",
]);

export function can(role: Role, action: Action, resource?: { isLocked?: boolean }): boolean {
  if (role === ROLE.ADMIN) return true;

  // Locked tasks block due-date edits for everyone below admin, layered on top of the
  // general task.update grant — checked by callers alongside can(role, "task.update").
  // Unlocked tasks fall through to that general grant instead; this action only matters
  // once resource.isLocked is true, at which point admin (already returned above) is the
  // only role that may still move the due date.
  if (action === "task.edit_due_date_when_locked") return !resource?.isLocked;

  if (role === ROLE.STANDARD_USER) return STANDARD_USER_ALLOWED.has(action);
  if (role === ROLE.VIEWER) return VIEWER_ALLOWED.has(action);

  return false;
}

export function isAdmin(role: Role): boolean {
  return role === ROLE.ADMIN;
}
