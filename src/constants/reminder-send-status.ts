import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// One scheduled reminder email's state on the Notifications page's schedule table — see
// data/reminders.ts's sendStatus() for how each is decided.
export const REMINDER_SEND_STATUS_CONFIG: StatusBadgeConfig = {
  upcoming: {
    label: "Scheduled",
    className: "bg-status-progress-soft text-status-progress-text",
  },
  passed: {
    label: "Date passed",
    className: "bg-muted text-muted-foreground",
  },
  paused: {
    label: "Paused",
    className: "bg-prio-med-soft text-prio-med",
  },
  cancelled: {
    label: "Task complete",
    className: "bg-status-complete-soft text-status-complete-text",
  },
};
