import "server-only";
import { isValid } from "date-fns";
import { taskCreateSchema, type TaskCreateInput } from "@/app/(app)/tasks/schema";
import { importFieldLabel, type TaskImportField } from "@/app/(app)/tasks/import/task-import-columns";
import type { ImportSheetRow } from "@/app/(app)/tasks/import/parse-import-file";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { TASK_PRIORITY_CONFIG } from "@/constants/task-priority";
import { DPSP_CATEGORY_CONFIG } from "@/constants/dpsp-category";
import { dayFirstDateToIso, parseDateOnly } from "@/lib/dates";
import { partyKey } from "@/lib/party";
import type { StatusBadgeConfig } from "@/components/shared/status-badge";
import type { TaskImportLookups } from "@/data/task-import-lookups";

type NameIndex = Map<string, string[]>;

function addToIndex(index: NameIndex, name: string | null, id: string) {
  const key = name?.trim();
  if (!key) return;
  const ids = index.get(key) ?? [];
  if (!ids.includes(id)) index.set(key, [...ids, id]);
}

// An enum cell accepts the label the app shows ("In Progress", what the export writes) or the
// stored value ("in_progress"), case-insensitively — these are a closed set, unlike lookup names.
function indexEnum(config: StatusBadgeConfig): Map<string, string> {
  return new Map(
    Object.entries(config).flatMap(([value, { label }]) => [
      [label.toLowerCase(), value],
      [value.toLowerCase(), value],
    ])
  );
}

const STATUS_INDEX = indexEnum(TASK_STATUS_CONFIG);
const GENDER_INDEX = indexEnum(TASK_GENDER_CONFIG);
const PRIORITY_INDEX = indexEnum(TASK_PRIORITY_CONFIG);
const DPSP_INDEX = indexEnum(DPSP_CATEGORY_CONFIG);

export interface TaskImportIndexes {
  seasons: NameIndex;
  brands: NameIndex;
  keyStages: NameIndex;
  parties: NameIndex;
}

// Lookup names are matched exactly (after trimming): the sheet is filled from the app's own
// names, and seasons deliberately differ only by case (`RJ'S H1'27` vs `RJ's H2'27`, see
// things-to-know.md § Seasons). A person matches on full name or email (the export writes the
// email when there's no name), a department on its name. Names are not unique in the database,
// so each maps to every id carrying it and the resolver refuses to guess between them.
export function buildTaskImportIndexes(lookups: TaskImportLookups): TaskImportIndexes {
  const indexes: TaskImportIndexes = { seasons: new Map(), brands: new Map(), keyStages: new Map(), parties: new Map() };
  for (const season of lookups.seasons) addToIndex(indexes.seasons, season.season, season.id);
  for (const brand of lookups.brands) addToIndex(indexes.brands, brand.brand_name, brand.id);
  for (const stage of lookups.keyStages) addToIndex(indexes.keyStages, stage.name, stage.id);
  for (const department of lookups.departments) {
    addToIndex(indexes.parties, department.name, partyKey({ kind: "department", id: department.id }));
  }
  for (const profile of lookups.profiles) {
    const key = partyKey({ kind: "user", id: profile.id });
    addToIndex(indexes.parties, profile.full_name, key);
    addToIndex(indexes.parties, profile.email, key);
  }
  return indexes;
}

// The schema names an FK by its column; the sheet names it by its header.
const IMPORT_FIELD_BY_SCHEMA_KEY: Record<string, TaskImportField> = {
  season_id: "season",
  brand_id: "brand",
  key_stage_id: "key_stage",
};

const TRUE_FLAGS = new Set(["true", "yes", "y", "1"]);
const FALSE_FLAGS = new Set(["false", "no", "n", "0"]);

class RowProblems {
  readonly messages: string[] = [];
  readonly fields = new Set<TaskImportField>();

  add(message: string, field?: TaskImportField) {
    if (this.messages.includes(message)) return;
    this.messages.push(message);
    if (field) this.fields.add(field);
  }

  lookup(index: NameIndex, value: string, field: TaskImportField): string | undefined {
    if (!value) return undefined;
    const ids = index.get(value) ?? [];
    if (ids.length === 1) return ids[0];
    this.add(
      ids.length === 0
        ? `${importFieldLabel(field)} "${value}" not found`
        : `${importFieldLabel(field)} "${value}" matches more than one record`,
      field
    );
    return undefined;
  }

  enumValue(index: Map<string, string>, value: string, field: TaskImportField, fallback: string) {
    if (!value) return fallback;
    const match = index.get(value.toLowerCase());
    if (!match) this.add(`${importFieldLabel(field)} "${value}" isn't a valid option`, field);
    return match ?? fallback;
  }

  date(value: string, field: TaskImportField): string {
    if (!value) return "";
    const iso = dayFirstDateToIso(value);
    if (!iso || !isValid(parseDateOnly(iso))) {
      this.add(`${importFieldLabel(field)} "${value}" must be a date in DD-MM-YYYY format`, field);
      return "";
    }
    return iso;
  }

  // Critical Task: blank means not critical. Accepts what the export writes (TRUE/FALSE, or an
  // Excel boolean, which reads back as "true"/"false") and the obvious hand-typed forms.
  flag(value: string, field: TaskImportField): boolean {
    if (!value) return false;
    const normalised = value.toLowerCase();
    if (TRUE_FLAGS.has(normalised)) return true;
    if (FALSE_FLAGS.has(normalised)) return false;
    this.add(`${importFieldLabel(field)} "${value}" must be Yes or No`, field);
    return false;
  }

  // Owners / People Involved hold several names joined by ", " (how the export writes them).
  // A department or person name can itself contain a comma, so adjacent pieces are rejoined,
  // longest first, until they form a known name rather than splitting blindly on every comma.
  parties(index: NameIndex, value: string, field: TaskImportField): string[] {
    const pieces = value.split(",").map((piece) => piece.trim()).filter(Boolean);
    const keys: string[] = [];
    let start = 0;
    while (start < pieces.length) {
      let end = pieces.length;
      while (end > start + 1 && !index.has(pieces.slice(start, end).join(", "))) end--;
      const key = this.lookup(index, pieces.slice(start, end).join(", "), field);
      if (key && !keys.includes(key)) keys.push(key);
      start = end;
    }
    return keys;
  }
}

export type ResolvedImportRow =
  | { ok: true; input: TaskCreateInput }
  | { ok: false; error: string; fields: TaskImportField[] };

// One sheet row → the exact input the Add Task form submits, then through the same
// taskCreateSchema, so an imported task meets every rule a hand-made one does. Every problem in
// the row is reported together, not just the first, so a row can be fixed in one pass.
export function resolveImportRow({ values }: ImportSheetRow, indexes: TaskImportIndexes): ResolvedImportRow {
  const problems = new RowProblems();
  const text = (field: TaskImportField) => values[field]?.trim() ?? "";

  const candidate = {
    task_name: text("task_name"),
    notes: text("notes") || undefined,
    status: problems.enumValue(STATUS_INDEX, text("status"), "status", "not_started"),
    // Priority is hidden from the Add Task form, which submits "med" (the column's own default).
    priority: problems.enumValue(PRIORITY_INDEX, text("priority"), "priority", "med"),
    gender: problems.enumValue(GENDER_INDEX, text("gender"), "gender", ""),
    dpsp_category: problems.enumValue(DPSP_INDEX, text("dpsp_category"), "dpsp_category", ""),
    season_id: problems.lookup(indexes.seasons, text("season"), "season") ?? "",
    brand_id: problems.lookup(indexes.brands, text("brand"), "brand") ?? "",
    key_stage_id: problems.lookup(indexes.keyStages, text("key_stage"), "key_stage") ?? "",
    due_date: problems.date(text("due_date"), "due_date"),
    start_date: problems.date(text("start_date"), "start_date"),
    end_date: problems.date(text("end_date"), "end_date"),
    owners: problems.parties(indexes.parties, text("owners"), "owners"),
    people_involved: problems.parties(indexes.parties, text("people_involved"), "people_involved"),
    is_critical: problems.flag(text("is_critical"), "is_critical"),
  };

  // Schema messages for fields that already have a lookup/format problem would only repeat it
  // less precisely ("Brand is required" after "Brand "X" not found"), so the schema only speaks
  // for what the lookups didn't already explain.
  const parsed = taskCreateSchema.safeParse(candidate);
  if (problems.messages.length === 0 && parsed.success) return { ok: true, input: parsed.data };
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      const field = IMPORT_FIELD_BY_SCHEMA_KEY[key] ?? (key as TaskImportField);
      if (!problems.fields.has(field)) problems.add(issue.message, field);
    }
  }
  return { ok: false, error: problems.messages.join("; "), fields: [...problems.fields] };
}
