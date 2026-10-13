import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Labels for every stored value (storedTaskGenderValues), so existing guys/girls rows still
// render. What can be *selected* is taskGenderValues (schema.ts) — derive options from that,
// not from this map.
export const TASK_GENDER_CONFIG: StatusBadgeConfig = {
  unisex: {
    label: "Unisex",
    className: "border border-border bg-muted text-muted-foreground",
  },
  guys: {
    label: "Guys",
    className: "border border-gender-guys-base bg-gender-guys-soft text-gender-guys-text",
  },
  girls: {
    label: "Girls",
    className: "border border-gender-girls-base bg-gender-girls-soft text-gender-girls-text",
  },
};
