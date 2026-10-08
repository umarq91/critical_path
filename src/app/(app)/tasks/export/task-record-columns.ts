import { taskOwners, taskPeopleInvolved } from "@/app/(app)/tasks/task-parties";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { DPSP_CATEGORY_CONFIG } from "@/constants/dpsp-category";
import { toExportDateOnly } from "@/lib/export/dates";
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
// The columns are what the Task Management grid shows (tasks/columns.tsx), nothing export-only —
// no Locked, Task ID, Created/Updated or Created/Last Edited By. Two grid cells map to more than
// one export column: Working Timeline is split into Start Date / Expected Finish (one range cell
// isn't sortable in a spreadsheet), and Critical Task is its own column because the grid only
// shows it as a row tint. Priority is hidden everywhere in the UI (client request), so it isn't
// offered here.
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
        key: "gender",
        label: "Gender",
        category: "basic",
        defaultSelected: true,
        dataType: "string",
        width: 12,
        getValue: (t) => TASK_GENDER_CONFIG[t.gender]?.label ?? t.gender,
      },
      {
        key: "notes",
        label: "Comments",
        category: "basic",
        defaultSelected: true,
        dataType: "string",
        width: 40,
        getValue: (t) => t.notes ?? null,
      },
      {
        key: "is_critical",
        label: "Critical Task",
        category: "basic",
        defaultSelected: true,
        dataType: "boolean",
        width: 12,
        getValue: (t) => t.is_critical,
      },
    ],
  },
  {
    key: "classification",
    label: "Classification",
    columns: [
      { key: "season", label: "Season", category: "classification", defaultSelected: true, dataType: "string", width: 14, getValue: (t) => t.season?.season ?? null },
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
        category: "dates",
        defaultSelected: true,
        dataType: "date",
        width: 14,
        getValue: (t) => (t.due_date ? toExportDateOnly(t.due_date) : null),
      },
      {
        key: "start_date",
        label: "Start Date",
        category: "dates",
        defaultSelected: true,
        dataType: "date",
        width: 14,
        getValue: (t) => (t.start_date ? toExportDateOnly(t.start_date) : null),
      },
      {
        key: "end_date",
        label: "Expected Finish",
        category: "dates",
        defaultSelected: true,
        dataType: "date",
        width: 16,
        getValue: (t) => (t.end_date ? toExportDateOnly(t.end_date) : null),
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
    ],
  },
];

// The order columns land in the file: the Task Management grid's left-to-right order
// (tasks/columns.tsx — kept as a plain list because that module is "use client" and can't be
// imported into a Route Handler; update both together). The groups above only shape the export
// dialog's checklist. Critical Task sits beside Task Name, Start/Expected Finish where Working
// Timeline is.
export const TASK_GRID_COLUMN_ORDER = [
  "status",
  "season",
  "key_stage",
  "task_name",
  "is_critical",
  "owners",
  "people_involved",
  "start_date",
  "end_date",
  "due_date",
  "brand",
  "gender",
  "dpsp_category",
  "notes",
];
