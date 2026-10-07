import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// The season_status enum minus `planning`, which the app no longer offers. The
// mockup's "Pending" and "In progress" rows are dummy-data noise, not real states.
// Soft fill + a matching colored border + colored text, each pulled from an existing
// globals.css token trio (-base for the border, -soft for the fill, -text for the text)
// rather than a raw hex.
export const SEASON_STATUS_CONFIG: StatusBadgeConfig = {
  upcoming: {
    label: "Upcoming",
    className: "border border-status-notstarted-base bg-status-notstarted-soft text-status-notstarted-text",
  },
  active: {
    label: "Active",
    className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text",
  },
  completed: {
    label: "Completed",
    className: "border border-status-progress-base bg-status-progress-soft text-status-progress-text",
  },
};
