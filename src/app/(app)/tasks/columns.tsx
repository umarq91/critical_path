"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { MessageSquare } from "lucide-react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ColorTag } from "@/components/shared/color-tag";
import { EditableCell } from "@/components/shared/editable-cell";
import { RowEditToggle } from "@/components/shared/row-edit-toggle";
import type { RowEditingState } from "@/components/data-table/use-row-editing";
import { dataTableFeatures, type DataTableFilterOption } from "@/components/data-table/table-features";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { DPSP_CATEGORY_CONFIG } from "@/constants/dpsp-category";
import { cn } from "@/lib/utils";
import { TaskRowActions } from "@/app/(app)/tasks/task-row-actions";
import { PartyStack } from "@/app/(app)/tasks/party-stack";
import { taskOwners, taskPeopleInvolved } from "@/app/(app)/tasks/task-parties";
import type { Task } from "@/data/tasks";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Task>();

const STATUS_OPTIONS = Object.entries(TASK_STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
const GENDER_OPTIONS = Object.entries(TASK_GENDER_CONFIG).map(([value, { label }]) => ({ value, label }));
const DPSP_CATEGORY_OPTIONS = Object.entries(DPSP_CATEGORY_CONFIG).map(([value, { label }]) => ({ value, label }));
// Priority is temporarily hidden across the Tasks module (grid, form, filters, detail drawer)
// per client request — the column and its data stay in the DB, this is UI-only.
const EDITABLE_FIELDS = [
  "task_name",
  "season_id",
  "brand_id",
  "key_stage_id",
  "dpsp_category",
  "gender",
  "due_date",
  "status",
  "notes",
] as const;

interface CreateTaskColumnsOptions {
  canManage: boolean;
  canDelete: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (task: Task) => void;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
  /** Whether the grid has actually been manually resized yet (see DataTable's own
   *  `onResizedChange`) — headers only wrap/shrink once true, so the default render stays
   *  pixel-identical to a non-resizable table. Plumbed in as a plain boolean, tracked in
   *  tasks-board.tsx's own state, rather than re-derived from the TanStack table instance a
   *  header render function receives — v9's state is atom-backed, not a plain property read. */
  isResized: boolean;
}

export function createTaskColumns({
  canManage,
  canDelete,
  rowEditing,
  isSaving,
  onConfirmEdit,
  seasonOptions,
  brandOptions,
  keyStageOptions,
  isResized,
}: CreateTaskColumnsOptions) {
  // The inline-edit select needs an explicit "not set" choice since key_stage_id is
  // optional — the filter dropdown (passed separately by tasks-board.tsx) doesn't need one.
  // Sentinel is "none", not "" — EditableCell's Select ignores onValueChange when the new
  // value is falsy (its guard against Base UI firing a spurious empty value on close), so an
  // empty-string option would be unselectable; "none" is normalised back to null in _actions.ts.
  const keyStageEditOptions = [{ value: "none", label: "No key stage" }, ...keyStageOptions];
  const brandEditOptions = [{ value: "none", label: "No brand" }, ...brandOptions];
  const dpspCategoryEditOptions = [{ value: "none", label: "No category" }, ...DPSP_CATEGORY_OPTIONS];

  return [
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" wrap={isResized} />,
      meta: { label: "Status", width: "sm" },
      size: 140,
      minSize: 90,
      filterFn: "weakEquals",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={<StatusBadge value={getValue()} config={TASK_STATUS_CONFIG} />}
          variant="select"
          options={STATUS_OPTIONS}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.status}
          onDraftChange={(next) => rowEditing.setDraftField("status", next)}
        />
      ),
    }),
    columnHelper.accessor("season_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Season" wrap={isResized} />,
      meta: { label: "Season", width: "md" },
      size: 176,
      minSize: 100,
      filterFn: "weakEquals",
      cell: ({ row }) => {
        const season = row.original.season;
        return (
          <EditableCell
            value={row.original.season_id}
            display={season ? <ColorTag label={season.season_name} color={season.color} /> : "—"}
            variant="select"
            options={seasonOptions}
            isEditing={rowEditing.isEditing(row.original.id)}
            draftValue={rowEditing.draft.season_id}
            onDraftChange={(next) => rowEditing.setDraftField("season_id", next)}
          />
        );
      },
    }),
    columnHelper.accessor("key_stage_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Key Stage" wrap={isResized} />,
      meta: { label: "Key Stage", width: "xs" },
      size: 130,
      minSize: 80,
      filterFn: "weakEquals",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.key_stage_id ?? "none"}
          display={row.original.key_stage?.name ?? <span className="text-muted-foreground">—</span>}
          variant="select"
          options={keyStageEditOptions}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.key_stage_id}
          onDraftChange={(next) => rowEditing.setDraftField("key_stage_id", next)}
        />
      ),
    }),
    columnHelper.accessor("task_name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Task Name" wrap={isResized} />,
      meta: { label: "Task Name", width: "lg" },
      size: 240,
      minSize: 140,
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.task_name}
          onDraftChange={(next) => rowEditing.setDraftField("task_name", next)}
        />
      ),
    }),
    // Display, not accessor: owners are rows in task_participants, not a column on the task,
    // so there's nothing to sort on and no single value an inline select could edit. Owners
    // are changed in the detail drawer, where the full add/remove list fits.
    columnHelper.display({
      id: "owners",
      header: "Owner",
      meta: { label: "Owner", width: "sm" },
      size: 150,
      minSize: 90,
      cell: ({ row }) => <PartyStack parties={taskOwners(row.original)} showSoleName />,
    }),
    columnHelper.display({
      id: "people",
      header: "People Involved",
      meta: { label: "People Involved", width: "sm" },
      size: 170,
      minSize: 90,
      cell: ({ row }) => <PartyStack parties={taskPeopleInvolved(row.original)} />,
    }),
    // Display, not accessor: shows the working-timeline date range (start_date/end_date), a
    // separate concept from due_date below — neither field has an EditableCell variant that
    // edits two dates as one range yet, so like Owners this is display-only for now, edited via
    // the create/detail form's own Start Date / Expected Finish Date fields.
    columnHelper.display({
      id: "working_timeline",
      header: "Working Timeline",
      meta: { label: "Working Timeline", width: "sm" },
      size: 170,
      minSize: 100,
      cell: ({ row }) => {
        const { start_date, end_date } = row.original;
        if (!start_date && !end_date) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-muted-foreground">
            {start_date ? formatDate(start_date) : "—"} – {end_date ? formatDate(end_date) : "—"}
          </span>
        );
      },
    }),
    columnHelper.accessor("due_date", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" wrap={isResized} />,
      meta: { label: "Due Date", width: "md" },
      size: 150,
      minSize: 90,
      sortFn: "datetime",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue() ?? ""}
          display={
            getValue() ? (
              <span className={cn(row.original.status === "overdue" && "font-medium text-status-overdue-text")}>
                {formatDate(getValue()!)}
              </span>
            ) : (
              <span className="text-muted-foreground">No due date</span>
            )
          }
          variant="date"
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.due_date}
          onDraftChange={(next) => rowEditing.setDraftField("due_date", next)}
        />
      ),
    }),
    columnHelper.accessor("brand_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brand" wrap={isResized} />,
      meta: { label: "Brand", width: "xs" },
      size: 130,
      minSize: 80,
      filterFn: "weakEquals",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.brand_id ?? "none"}
          display={row.original.brand?.brand_name ?? <span className="text-muted-foreground">—</span>}
          variant="select"
          options={brandEditOptions}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.brand_id}
          onDraftChange={(next) => rowEditing.setDraftField("brand_id", next)}
        />
      ),
    }),
    columnHelper.accessor("gender", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gender" wrap={isResized} />,
      meta: { label: "Gender", width: "xs" },
      size: 110,
      minSize: 80,
      filterFn: "weakEquals",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={<StatusBadge value={getValue()} config={TASK_GENDER_CONFIG} />}
          variant="select"
          options={GENDER_OPTIONS}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.gender}
          onDraftChange={(next) => rowEditing.setDraftField("gender", next)}
        />
      ),
    }),
    columnHelper.accessor("dpsp_category", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="DPSP Category" wrap={isResized} />,
      meta: { label: "DPSP Category", width: "xs" },
      size: 130,
      minSize: 80,
      filterFn: "weakEquals",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue() ?? "none"}
          display={
            getValue() ? (
              <StatusBadge value={getValue()!} config={DPSP_CATEGORY_CONFIG} />
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
          variant="select"
          options={dpspCategoryEditOptions}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.dpsp_category}
          onDraftChange={(next) => rowEditing.setDraftField("dpsp_category", next)}
        />
      ),
    }),
    // "Comments" is this row's own free-text `notes` field, not a threaded/counted feed —
    // shown as a truncated preview rather than a fabricated count.
    columnHelper.accessor("notes", {
      header: "Comments",
      meta: { label: "Comments", width: "lg" },
      size: 220,
      minSize: 120,
      enableSorting: false,
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue() ?? ""}
          display={
            getValue() ? (
              <span className="flex max-w-48 items-center gap-1.5 truncate text-muted-foreground">
                <MessageSquare className="size-3.5 shrink-0" />
                {getValue()}
              </span>
            ) : (
              "—"
            )
          }
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.notes}
          onDraftChange={(next) => rowEditing.setDraftField("notes", next)}
        />
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right", width: "xs" },
      size: 100,
      minSize: 80,
      cell: ({ row }) => {
        if (!canManage && !canDelete) return null;
        const task = row.original;
        const editing = rowEditing.isEditing(task.id);

        return (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            {canManage ? (
              <RowEditToggle
                isEditing={editing}
                isSaving={editing && isSaving}
                onEdit={() => {
                  const initialDraft = Object.fromEntries(
                    EDITABLE_FIELDS.map((field) => [
                      field,
                      // key_stage_id/dpsp_category's "not set" sentinel is "none", not "" —
                      // see keyStageEditOptions/dpspCategoryEditOptions above.
                      field === "key_stage_id" || field === "dpsp_category"
                        ? (task[field] ?? "none")
                        : (task[field] ?? ""),
                    ])
                  );
                  rowEditing.startEditing(task.id, initialDraft);
                }}
                onConfirm={() => onConfirmEdit(task)}
              />
            ) : null}
            {canDelete ? <TaskRowActions taskId={task.id} taskName={task.task_name} /> : null}
          </div>
        );
      },
    }),
  ];
}
