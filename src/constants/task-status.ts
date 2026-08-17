import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Matches supabase/schema.md's task_status enum exactly (not_started/in_progress/completed/overdue).
export const TASK_STATUS_CONFIG: StatusBadgeConfig = {
  not_started: {
    label: "Not Started",
    className: "border border-status-notstarted-base bg-status-notstarted-soft text-status-notstarted-text",
  },
  in_progress: {
    label: "In Progress",
    className: "border border-status-progress-base bg-status-progress-soft text-status-progress-text",
  },
  completed: {
    label: "Complete",
    className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text",
  },
  overdue: {
    label: "Overdue",
    className: "border border-status-overdue-base bg-status-overdue-soft text-status-overdue-text",
  },
};
