import { TASK_GRID_COLUMN_ORDER, TASK_RECORD_COLUMN_GROUPS } from "@/app/(app)/tasks/export/task-record-columns";
import { TASK_FIELD_VISIBILITY } from "@/constants/task-field-visibility";

// The export columns a task import reads. Headers are the export's own labels (looked up below,
// not retyped), so an exported sheet can be edited and uploaded straight back, and the template
// can never drift from the export.
const IMPORT_FIELDS = [
  "task_name",
  "status",
  "gender",
  "notes",
  "season",
  "brand",
  "key_stage",
  "dpsp_category",
  "due_date",
  "start_date",
  "end_date",
  "owners",
  "people_involved",
  "is_critical",
] as const;

export type TaskImportField = (typeof IMPORT_FIELDS)[number];

// Status, Brand and Gender are hidden across the app for now (TASK_FIELD_VISIBILITY). Their
// headers are left out of the template and a sheet's column for them is ignored, the same way
// Priority is: every imported task gets "not_started" and no brand or gender.
const HIDDEN_IMPORT_FIELDS = new Set<TaskImportField>([
  ...(TASK_FIELD_VISIBILITY.status ? [] : (["status"] as const)),
  ...(TASK_FIELD_VISIBILITY.brand ? [] : (["brand"] as const)),
  ...(TASK_FIELD_VISIBILITY.gender ? [] : (["gender"] as const)),
]);

export function isVisibleImportField(field: TaskImportField) {
  return !HIDDEN_IMPORT_FIELDS.has(field);
}

const DATE_FIELDS: ReadonlySet<TaskImportField> = new Set(["due_date", "start_date", "end_date"]);

// A whole-file error when any of these is absent from the header row, rather than every row
// failing with the same message. Status, Comments, Critical Task and the dates may be
// left out. Brand and Gender are no longer required (optional at creation since they were
// hidden), even once they're visible again.
export const REQUIRED_IMPORT_FIELDS: TaskImportField[] = [
  "task_name",
  "season",
  "key_stage",
  "dpsp_category",
  "owners",
  "people_involved",
];

const LABEL_BY_KEY = new Map(
  TASK_RECORD_COLUMN_GROUPS.flatMap((group) => group.columns).map((column) => [column.key, column.label])
);

export function importFieldLabel(field: TaskImportField) {
  return LABEL_BY_KEY.get(field) ?? field;
}

// "Due Date (DD-MM-YYYY)", "due_date" and "DUE DATE" all name the same column: case, spacing,
// punctuation and a bracketed hint are ignored, because a sheet re-saved in other spreadsheet
// software doesn't reliably keep exact header text.
export function normaliseImportHeader(header: string) {
  return header
    .replace(/\(.*?\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const IMPORT_FIELD_BY_HEADER: ReadonlyMap<string, TaskImportField> = new Map(
  IMPORT_FIELDS.filter(isVisibleImportField).flatMap((field) => [
    [normaliseImportHeader(importFieldLabel(field)), field],
    [normaliseImportHeader(field), field],
  ])
);

// Template headers in the export's own left-to-right order. Date columns carry the format hint,
// since the template has no sample row to show it.
export const TASK_IMPORT_TEMPLATE_HEADERS = TASK_GRID_COLUMN_ORDER.flatMap((key) => {
  const field = IMPORT_FIELDS.find((candidate) => candidate === key);
  if (!field) return [];
  const label = importFieldLabel(field);
  return [DATE_FIELDS.has(field) ? `${label} (DD-MM-YYYY)` : label];
});

export const MAX_TASK_IMPORT_ROWS = 1000;

/** One sheet row as the preview and the results list show it. `ready` exists only in the
 *  preview; after importing, a ready row is `created`, or `invalid` if saving it failed. */
export interface TaskImportRow {
  /** The row number as the user sees it in their spreadsheet (header = row 1). */
  row: number;
  /** The row's cells as typed, keyed by import field. */
  cells: Partial<Record<TaskImportField, string>>;
  status: "ready" | "created" | "duplicate" | "invalid";
  error?: string;
  /** The cells the error is about, highlighted in the list. */
  problemFields?: TaskImportField[];
}

// Next.js's default Server Action body limit. A 1000-row sheet is well under it; checked on the
// client so an oversized file gets a clear message instead of an opaque request failure.
export const MAX_TASK_IMPORT_FILE_BYTES = 1024 * 1024;
