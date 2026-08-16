import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Matches supabase/schema.md's season_status enum exactly (planning/upcoming/active/completed) —
// the mockup's "Pending" and "In progress" rows are dummy-data noise, not real states.
export const SEASON_STATUS_CONFIG: StatusBadgeConfig = {
  planning: { label: "Planning", className: "bg-muted text-muted-foreground" },
  upcoming: { label: "Upcoming", className: "border border-border text-foreground" },
  active: { label: "Active", className: "bg-status-complete-soft text-status-complete-text" },
  completed: { label: "Completed", className: "bg-status-progress-soft text-status-progress-text" },
};
