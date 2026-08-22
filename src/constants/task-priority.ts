import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Matches supabase/schema.md's task_priority enum exactly (high/med/low). Unlike task-status.ts
// and task-gender.ts, prio-* tokens are a 2-tier pair (base color doubles as border + text,
// -soft is the fill) rather than a base/soft/text triad — see globals.css.
export const TASK_PRIORITY_CONFIG: StatusBadgeConfig = {
  high: {
    label: "High",
    className: "border border-prio-high bg-prio-high-soft text-prio-high",
  },
  med: {
    label: "Medium",
    className: "border border-prio-med bg-prio-med-soft text-prio-med",
  },
  low: {
    label: "Low",
    className: "border border-prio-low bg-prio-low-soft text-prio-low",
  },
};
