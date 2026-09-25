import { taskOwners, taskPeopleInvolved } from "@/app/(app)/tasks/task-parties";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { TASK_PRIORITY_CONFIG } from "@/constants/task-priority";
import { DPSP_CATEGORY_CONFIG } from "@/constants/dpsp-category";
import { toExportDateOnly, toExportTimestamp } from "@/lib/export/dates";
import type { ExportColumnGroup } from "@/lib/export/types";
import type { Task } from "@/data/tasks";

function partyNames(parties: { name: string }[]) {
  return parties.length > 0 ? parties.map((party) => party.name).join(", ") : null;
}

// One row per task, drawn from the SAME `Task` shape the grid, the Timeline and the detail
// drawer already render — this is deliberately not a second, export-specific query result.
// Shared by two callers: the Task Management export dialog (tasks/export/route.ts, every
// column, filtered/sorted by the grid's own current state) and the Dashboard export dialog
// (dashboard/export/route.ts, unfiltered, one section among several) — hence living under
// tasks/export/ rather than either page's own folder.
// `assignee_id`/`assignee` is deliberately NOT a column here: schema.md marks it superseded by
// `task_participants` ("owner is 1..n parties... don't write to it in new code"), so surfacing
// it in an export would hand out a column that quietly disagrees with the Owners column derived
// from the current source of truth.
//
// Categories and default-on/off follow the same "important vs optional" call the rest of the
// app already makes for this data: what's on the task grid by default (name, status, season,
// brand, key stage, due date) stays on; audit-trail and rarely-populated fields (created/updated
// timestamps, working-timeline dates, the raw id) start off but stay available. Priority is
// temporarily hidden from the grid/form/drawer (client request) and defaults off here too, for
// the same reason — still selectable, just not surfaced unless asked for.
export const TASK_RECORD_COLUMN_GROUPS: ExportColumnGroup<Task>[] = [
  {
    key: "basic",
    label: "Task Details",
    columns: [
      { key: "task_name", label: "Task Name", category: "basic", defaultSelected: true, dataType: "string", width: 42, getValue: (t) => t.task_name },
      {
        key: "status",
        label: "Status",
        category: "basic",
        defaultSelected: true,
        dataType: "string",
        width: 14,
        getValue: (t) => TASK_STATUS_CONFIG[t.status]?.label ?? t.status,
      },
      {
        key: "priority",
        label: "Priority",
        category: "basic",
        defaultSelected: false,
        dataType: "string",
        width: 12,
        getValue: (t) => TASK_PRIORITY_CONFIG[t.priority]?.label ?? t.priority,
      },
      {
        key: "gender",
        label: "Gender",
        description: "The range this task's work belongs to — guys or girls (legacy tasks may still say unisex).",
        category: "basic",
        defaultSelected: true,
        dataType: "string",
        width: 12,
        getValue: (t) => TASK_GENDER_CONFIG[t.gender]?.label ?? t.gender,
      },
      {
        key: "notes",
        label: "Comments",
        description: "The task's free-text notes — the grid's Comments column.",
        category: "basic",
        defaultSelected: true,
        dataType: "string",
        width: 40,
        getValue: (t) => t.notes ?? null,
      },
      {
        key: "is_locked",
        label: "Locked",
        description: "Whether the due date is locked against further edits.",
        category: "basic",
        defaultSelected: false,
        dataType: "boolean",
        width: 10,
        getValue: (t) => t.is_locked,
      },
      {
        key: "id",
        label: "Task ID",
        description: "The internal record identifier — useful for cross-referencing with other exports.",
        category: "basic",
        defaultSelected: false,
        dataType: "string",
        width: 38,
        getValue: (t) => t.id,
      },
    ],
  },
  {
    key: "classification",
    label: "Classification",
    columns: [
      { key: "season", label: "Season", category: "classification", defaultSelected: true, dataType: "string", width: 20, getValue: (t) => t.season?.season_name ?? null },
      {
        key: "season_code",
        label: "Season Code",
        description: "The season's short code, distinct from its display name.",
        category: "classification",
        defaultSelected: false,
        dataType: "string",
        width: 14,
        getValue: (t) => t.season?.season_code ?? null,
      },
      { key: "brand", label: "Brand", category: "classification", defaultSelected: true, dataType: "string", width: 20, getValue: (t) => t.brand?.brand_name ?? null },
      { key: "key_stage", label: "Key Stage", category: "classification", defaultSelected: true, dataType: "string", width: 24, getValue: (t) => t.key_stage?.name ?? null },
      {
        key: "dpsp_category",
        label: "DPSP Category",
        category: "classification",
        defaultSelected: true,
        dataType: "string",
        width: 16,
        getValue: (t) => (t.dpsp_category ? (DPSP_CATEGORY_CONFIG[t.dpsp_category]?.label ?? t.dpsp_category) : null),
      },
    ],
  },
  {
    key: "dates",
    label: "Dates",
    columns: [
      {
        key: "due_date",
        label: "Due Date",
        description: "Blank for tasks imported without a known due date — they never count as overdue.",
        category: "dates",
        defaultSelected: true,
        dataType: "date",
        width: 14,
        getValue: (t) => (t.due_date ? toExportDateOnly(t.due_date) : null),
      },
      {
        key: "start_date",
        label: "Start Date",
        description: "Working-timeline start. Frequently blank — most tasks aren't scheduled to this level of detail.",
        category: "dates",
        defaultSelected: false,
        dataType: "date",
        width: 14,
        getValue: (t) => (t.start_date ? toExportDateOnly(t.start_date) : null),
      },
      {
        key: "end_date",
        label: "Expected Finish",
        description: "Working-timeline end. Frequently blank, same as Start Date.",
        category: "dates",
        defaultSelected: false,
        dataType: "date",
        width: 16,
        getValue: (t) => (t.end_date ? toExportDateOnly(t.end_date) : null),
      },
      {
        key: "created_at",
        label: "Created At (UTC)",
        category: "dates",
        defaultSelected: false,
        dataType: "date",
        width: 20,
        getValue: (t) => toExportTimestamp(t.created_at),
      },
      {
        key: "updated_at",
        label: "Last Updated (UTC)",
        category: "dates",
        defaultSelected: false,
        dataType: "date",
        width: 20,
        getValue: (t) => toExportTimestamp(t.updated_at),
      },
    ],
  },
  {
    key: "people",
    label: "People & Ownership",
    columns: [
      {
        key: "owners",
        label: "Owners",
        description: "Every owner on the task — a person, a department, or several of either.",
        category: "people",
        defaultSelected: true,
        dataType: "string",
        width: 32,
        getValue: (t) => partyNames(taskOwners(t)),
      },
      {
        key: "people_involved",
        label: "People Involved",
        category: "people",
        defaultSelected: true,
        dataType: "string",
        width: 32,
        getValue: (t) => partyNames(taskPeopleInvolved(t)),
      },
      {
        key: "created_by",
        label: "Created By",
        category: "people",
        defaultSelected: false,
        dataType: "string",
        width: 24,
        getValue: (t) => t.created_by_profile?.full_name ?? t.created_by_profile?.email ?? null,
      },
      {
        key: "last_edited_by",
        label: "Last Edited By",
        category: "people",
        defaultSelected: false,
        dataType: "string",
        width: 24,
        getValue: (t) => t.last_edited_by_profile?.full_name ?? t.last_edited_by_profile?.email ?? null,
      },
    ],
  },
];

// The order columns land in the file: the Task Management grid's left-to-right order
// (tasks/columns.tsx — kept as a plain list because that module is "use client" and can't be
// imported into a Route Handler; update both together). The groups above only shape the export
// dialog's checklist. Export-only fields sit beside their grid counterpart (Season Code after
// Season, Start/Expected Finish where Working Timeline is); the rest trail after the grid's
// own columns.
export const TASK_GRID_COLUMN_ORDER = [
  "status",
  "season",
  "season_code",
  "key_stage",
  "task_name",
  "owners",
  "people_involved",
  "start_date",
  "end_date",
  "due_date",
  "brand",
  "gender",
  "dpsp_category",
  "notes",
  "priority",
  "is_locked",
  "created_by",
  "last_edited_by",
  "created_at",
  "updated_at",
  "id",
];
