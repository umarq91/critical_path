import { z } from "zod";
import { decodeMultiFilterValue } from "@/constants/data-table-filters";
import { isDueWeekPreset } from "@/constants/due-week-filter";
import { parsePartyKey } from "@/lib/party";
import { isUuid } from "@/lib/utils";

const savedViewName = z.string().trim().min(1, "Name is required").max(100);

const isPartyList = (value: string) => decodeMultiFilterValue(value).every((key) => parsePartyKey(key) !== null);
const isUuidList = (value: string) => decodeMultiFilterValue(value).every(isUuid);

// Every `filters` key listTasks() (data/tasks.ts) reads, with a check for the ones whose value
// has a fixed shape. A key outside this list, or a malformed value, rejects the save rather than
// storing a view that would later filter differently from what the grid showed.
const TASK_VIEW_FILTER_CHECKS: Record<string, ((value: string) => boolean) | null> = {
  season_id: isUuidList,
  brand_id: isUuidList,
  key_stage_id: isUuidList,
  owner: isPartyList,
  involved: isPartyList,
  due_week: isDueWeekPreset,
  is_critical: (value) => value === "yes" || value === "no",
  dpsp_category: null,
  gender: null,
  status: null,
  priority: null,
  hide_done: null,
  due_date: null,
  task_name: null,
  search: null,
};

const savedViewFilters = z
  .record(z.string(), z.string().max(4000))
  .refine(
    (filters) =>
      Object.entries(filters).every(([key, value]) => {
        if (!(key in TASK_VIEW_FILTER_CHECKS)) return false;
        const check = TASK_VIEW_FILTER_CHECKS[key];
        return check ? check(value) : true;
      }),
    { message: "These filters can't be saved as a view" }
  );

// Full payload the Server Action validates — filters/sortBy/sortDir come from the URL
// (data-table-search-params.ts), not user input, but are still re-validated server-side like
// everything else a Server Action receives.
export const savedViewSchema = z.object({
  name: savedViewName,
  filters: savedViewFilters,
  sortBy: z.string().max(64).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

// Overwriting an existing view's filters/sort — same checks, minus the name, which never changes.
export const savedViewStateSchema = savedViewSchema.omit({ name: true });

// What the "Save current filters" form actually collects — just the name. filters/sortBy/sortDir
// are read off the current URL by the caller, not typed by the user, so they don't belong on
// this form's own resolver.
export const savedViewNameSchema = z.object({ name: savedViewName });

export type SavedViewInput = z.infer<typeof savedViewSchema>;
export type SavedViewNameInput = z.infer<typeof savedViewNameSchema>;
