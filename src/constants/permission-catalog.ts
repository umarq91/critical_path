import type { Action } from "@/lib/permissions";

export interface PermissionCatalogEntry {
  action: Action;
  label: string;
  description: string;
  /** Passed to can() alongside the action. Only "task.edit_due_date_when_locked" needs it:
   *  without a locked resource that check answers "yes" for every role, which is true but
   *  says nothing — the row is only meaningful for a task that is actually locked. */
  resource?: { isLocked?: boolean };
}

export interface PermissionCatalogGroup {
  title: string;
  entries: PermissionCatalogEntry[];
}

// Presentation only — the allow-sets in lib/permissions.ts stay the single source of truth,
// and every cell in the matrix UI is computed by calling can(). This file adds the human
// labels that a bare Action union can't carry. A new Action shows up here as a missing entry,
// not as a wrong answer.
export const PERMISSION_CATALOG: PermissionCatalogGroup[] = [
  {
    title: "Tasks",
    entries: [
      { action: "task.view", label: "View tasks", description: "External users see only tasks they are involved in" },
      { action: "task.create", label: "Create tasks", description: "Add a task manually or from a template" },
      { action: "task.update", label: "Edit tasks", description: "Change task fields, including status" },
      { action: "task.delete", label: "Delete tasks", description: "Permanently remove a task" },
      { action: "task.assign", label: "Assign owners", description: "Set owner departments and people involved" },
      { action: "task.bulk_update", label: "Bulk edit", description: "Apply a change across many selected tasks" },
      { action: "task.comment", label: "Comment", description: "Post comments on a task" },
      { action: "task.upload_attachment", label: "Upload attachments", description: "Attach files to a task" },
      { action: "task.lock", label: "Lock due dates", description: "Freeze a task's due date against further edits" },
      {
        action: "task.edit_due_date_when_locked",
        label: "Edit a locked due date",
        description: "Move the due date of a task that has been locked",
        resource: { isLocked: true },
      },
    ],
  },
  {
    title: "Brands & lookups",
    entries: [
      { action: "brand.view", label: "View brands", description: "See the brand list" },
      { action: "brand.manage", label: "Manage brands", description: "Create and edit brands" },
      { action: "brand.delete", label: "Delete brands", description: "Permanently remove a brand" },
      { action: "lookups.view", label: "View lookups", description: "Seasons, key stages, templates, holidays, leave" },
    ],
  },
  {
    title: "Dashboard & calendar",
    entries: [
      { action: "dashboard.view", label: "View dashboard", description: "Charts and summaries for the tasks they can see" },
      { action: "dashboard.export_reports", label: "Export reports", description: "Download Excel and PDF exports" },
      { action: "calendar.sync_google", label: "Google Calendar sync", description: "Push their task due dates to Google Calendar" },
    ],
  },
  {
    title: "Administration",
    entries: [
      { action: "admin.manage_users", label: "Manage users", description: "Create external users, set roles, deactivate accounts" },
      { action: "admin.manage_lookups", label: "Manage lookups", description: "Edit seasons, key stages, templates, holidays, leave, reminder rules" },
      { action: "admin.view_audit_log", label: "View logs", description: "Read the activity log of who created, edited, reassigned or deleted a task" },
      { action: "profile.update_own", label: "Edit own profile", description: "Update their own name and details" },
    ],
  },
];
