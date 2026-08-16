import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Matches supabase/schema.md's season_status enum exactly (planning/upcoming/active/completed) —
// the mockup's "Pending" and "In progress" rows are dummy-data noise, not real states.
// Soft fill + a matching colored border + colored text, each pulled from an existing
// globals.css token trio (-base for the border, -soft for the fill, -text for the text)
// rather than a raw hex.
export const SEASON_STATUS_CONFIG: StatusBadgeConfig = {
  planning: {
    label: "Planning",
    className: "border border-prio-low bg-prio-low-soft text-prio-low",
  },
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
