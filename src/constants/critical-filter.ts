// The "Critical" filter on the Tasks toolbar and the Timeline toolbar. Values are the URL `filters.is_critical` key's
// vocabulary, read by listTasks (data/tasks.ts) and checked by saved-view-schema.ts.
export const CRITICAL_FILTER_OPTIONS = [
  { value: "yes", label: "Critical Only" },
  { value: "no", label: "Not Critical" },
];
