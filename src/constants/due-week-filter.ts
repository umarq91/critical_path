import { decodeMultiFilterValue } from "@/constants/data-table-filters";

// The Tasks toolbar's "Due" filter (see dueFilterRange in lib/dates.ts for each preset's dates,
// on the org's clock). Multi-select: the URL `filters.due_week` key holds a comma-joined list,
// matched as a union. The key keeps its original name so saved views written before the
// open-ended presets existed still load.
export const DUE_WEEK_OPTIONS = [
  { value: "all", label: "All Due Dates (incl. No Due Date)" },
  { value: "today_onwards", label: "Today & Upcoming Due Dates" },
  { value: "overdue", label: "Overdue Due Dates" },
  { value: "no_due_date", label: "No Due Date" },
  { value: "this_week", label: "This Week" },
  { value: "next_week", label: "Next Week" },
  { value: "next_2_weeks", label: "Next 2 Weeks" },
] as const;

export type DueWeekPreset = (typeof DUE_WEEK_OPTIONS)[number]["value"];
// The presets that are a date range; "all" and "no_due_date" aren't (see data/tasks.ts).
export type DueRangePreset = Exclude<DueWeekPreset, "all" | "no_due_date">;

export function isDueWeekPreset(value: string | undefined): value is DueWeekPreset {
  return DUE_WEEK_OPTIONS.some((option) => option.value === value);
}

export function decodeDueWeekPresets(value: string | undefined): DueWeekPreset[] {
  return decodeMultiFilterValue(value).filter(isDueWeekPreset);
}
