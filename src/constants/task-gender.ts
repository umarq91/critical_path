import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Matches supabase/schema.md's task_gender enum exactly (men/women/unisex).
export const TASK_GENDER_CONFIG: StatusBadgeConfig = {
  men: {
    label: "Men",
    className: "border border-gender-men-base bg-gender-men-soft text-gender-men-text",
  },
  women: {
    label: "Women",
    className: "border border-gender-women-base bg-gender-women-soft text-gender-women-text",
  },
  unisex: {
    label: "Unisex",
    className: "border border-gender-unisex-base bg-gender-unisex-soft text-gender-unisex-text",
  },
};
