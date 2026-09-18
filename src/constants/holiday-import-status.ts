import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// One row's outcome in a bulk CSV import — same generic <StatusBadge> as task status / calendar
// sync_status, a different config map, per CLAUDE.md's shared-components convention.
export const HOLIDAY_IMPORT_STATUS_CONFIG: StatusBadgeConfig = {
  created: {
    label: "Created",
    className: "bg-status-complete-soft text-status-complete-text",
  },
  duplicate: {
    label: "Duplicate",
    className: "bg-prio-med-soft text-prio-med",
  },
  invalid: {
    label: "Invalid",
    className: "bg-status-overdue-soft text-status-overdue-text",
  },
};
