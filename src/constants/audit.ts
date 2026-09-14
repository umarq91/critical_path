import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// `audit_log.action` is text, not an enum (see 0020) — this is the app-side vocabulary.
// Adding a verb here plus a config entry below is the whole change; no migration.
export const AUDIT_ACTION = {
  TASK_CREATE: "task.create",
  TASK_UPDATE: "task.update",
  TASK_DELETE: "task.delete",
  TASK_RESTORE: "task.restore",
  // One verb for both roles, not `task.owner_change` + `task.people_change`. The drawer saves
  // owners and people involved in a single confirmed action, and splitting that into two log
  // rows made one edit look like two.
  TASK_PARTICIPANTS_CHANGE: "task.participants_change",
  API_KEY_CREATE: "api_key.create",
  API_KEY_REVOKE: "api_key.revoke",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export const AUDIT_ENTITY_TYPE = { TASK: "task", API_KEY: "api_key" } as const;

// Same soft-fill + border + text token trio as every other badge config — no new colours.
// Create/delete borrow the complete/overdue status tokens because that's the semantic
// (added / removed); the two participant verbs share one treatment since they're the same
// kind of event on different roles.
export const AUDIT_ACTION_CONFIG: StatusBadgeConfig = {
  [AUDIT_ACTION.TASK_CREATE]: {
    label: "Created",
    className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text",
  },
  [AUDIT_ACTION.TASK_UPDATE]: {
    label: "Updated",
    className: "border border-status-progress-base bg-status-progress-soft text-status-progress-text",
  },
  [AUDIT_ACTION.TASK_DELETE]: {
    label: "Deleted",
    className: "border border-status-overdue-base bg-status-overdue-soft text-status-overdue-text",
  },
  [AUDIT_ACTION.TASK_RESTORE]: {
    label: "Restored",
    className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text",
  },
  [AUDIT_ACTION.TASK_PARTICIPANTS_CHANGE]: {
    label: "Reassigned",
    className: "border border-border-strong bg-primary-tint text-primary",
  },
  [AUDIT_ACTION.API_KEY_CREATE]: {
    label: "Created",
    className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text",
  },
  [AUDIT_ACTION.API_KEY_REVOKE]: {
    label: "Revoked",
    className: "border border-status-overdue-base bg-status-overdue-soft text-status-overdue-text",
  },
};

// Which list a party change happened in, for the Details cell.
export const PARTICIPANT_ROLE_LABEL: Record<string, string> = {
  owner: "Owners",
  involved: "People Involved",
};

// Column name → what the client calls it. Keys match tasks/schema.ts's field names, so a
// field-level diff renders "Due Date", not "due_date".
export const TASK_FIELD_LABEL: Record<string, string> = {
  task_name: "Task Name",
  season_id: "Season",
  brand_id: "Brand",
  key_stage_id: "Key Stage",
  gender: "Gender",
  due_date: "Due Date",
  start_date: "Start Date",
  end_date: "End Date",
  status: "Status",
  priority: "Priority",
  notes: "Comments",
};

// The Logs page's date filter. Values are resolved to a cutoff timestamp server-side in
// data/audit-log.ts — a select, not a date-range picker, because "what happened lately" is
// the question this page actually gets asked.
export const AUDIT_PERIOD = { TODAY: "today", WEEK: "7d", MONTH: "30d" } as const;

export const AUDIT_PERIOD_OPTIONS = [
  { value: AUDIT_PERIOD.TODAY, label: "Today" },
  { value: AUDIT_PERIOD.WEEK, label: "Last 7 days" },
  { value: AUDIT_PERIOD.MONTH, label: "Last 30 days" },
];
