// The Tasks toolbar's "Due" filter: Monday-to-Sunday calendar weeks on the org's clock (see
// dueWeekRange in lib/dates.ts). Values are the URL `filters.due_week` key's vocabulary.
export const DUE_WEEK_OPTIONS = [
  { value: "this_week", label: "This Week" },
  { value: "next_week", label: "Next Week" },
  { value: "next_2_weeks", label: "Next 2 Weeks" },
] as const;

export type DueWeekPreset = (typeof DUE_WEEK_OPTIONS)[number]["value"];

export function isDueWeekPreset(value: string | undefined): value is DueWeekPreset {
  return DUE_WEEK_OPTIONS.some((option) => option.value === value);
}
