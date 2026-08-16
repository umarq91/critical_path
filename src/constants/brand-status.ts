import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Matches supabase/schema.md's brand_status enum exactly. Same soft-fill + border + text
// treatment as SEASON_STATUS_CONFIG — each pulled from an existing globals.css token trio.
export const BRAND_STATUS_CONFIG: StatusBadgeConfig = {
  active: {
    label: "Active",
    className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text",
  },
  inactive: {
    label: "Inactive",
    className: "border border-status-overdue-base bg-status-overdue-soft text-status-overdue-text",
  },
};
