import { TASK_FIELD_VISIBILITY } from "@/constants/task-field-visibility";

const HIDDEN_FILTER_KEYS = new Set<string>([
  ...(TASK_FIELD_VISIBILITY.status ? [] : ["status"]),
  ...(TASK_FIELD_VISIBILITY.brand ? [] : ["brand_id"]),
  ...(TASK_FIELD_VISIBILITY.gender ? [] : ["gender"]),
]);

// A saved view or an older shared link can still carry a filter on a hidden field. With no
// control on screen to show or clear it, it would narrow the list invisibly, so it's dropped
// before the query runs. The view itself is left as saved, so it narrows again once the field is
// visible again.
export function withoutHiddenTaskFilters(filters: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).filter(([key]) => !HIDDEN_FILTER_KEYS.has(key)));
}
