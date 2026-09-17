import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Matches taskGenderValues (schema.ts) — Guys/Girls only, since 0026_task_gender_rename.sql. No
// "unisex" entry: it's retired from selection everywhere, so a legacy task that still has it
// (see that migration's comment) falls back to StatusBadge's raw-value display rather than a
// styled badge, which is the accepted trade-off for a value nothing here offers anymore.
export const TASK_GENDER_CONFIG: StatusBadgeConfig = {
  guys: {
    label: "Guys",
    className: "border border-gender-guys-base bg-gender-guys-soft text-gender-guys-text",
  },
  girls: {
    label: "Girls",
    className: "border border-gender-girls-base bg-gender-girls-soft text-gender-girls-text",
  },
};
