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
import { cn } from "@/lib/utils";
import { TaskRowActions } from "@/app/(app)/tasks/task-row-actions";
import { PartyStack } from "@/app/(app)/tasks/party-stack";
import { taskOwners, taskPeopleInvolved } from "@/app/(app)/tasks/task-parties";
import type { Task } from "@/data/tasks";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Task>();

const STATUS_OPTIONS = Object.entries(TASK_STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
const GENDER_OPTIONS = Object.entries(TASK_GENDER_CONFIG).map(([value, { label }]) => ({ value, label }));
// Priority is temporarily hidden across the Tasks module (grid, form, filters, detail drawer)
// per client request — the column and its data stay in the DB, this is UI-only.
const EDITABLE_FIELDS = [
  "task_name",
  "season_id",
  "brand_id",
  "key_stage_id",
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
}: CreateTaskColumnsOptions) {
  // The inline-edit select needs an explicit "not set" choice since key_stage_id is
  // optional — the filter dropdown (passed separately by tasks-board.tsx) doesn't need one.
  // Sentinel is "none", not "" — EditableCell's Select ignores onValueChange when the new
  // value is falsy (its guard against Base UI firing a spurious empty value on close), so an
  // empty-string option would be unselectable; "none" is normalised back to null in _actions.ts.
  const keyStageEditOptions = [{ value: "none", label: "No key stage" }, ...keyStageOptions];
  const brandEditOptions = [{ value: "none", label: "No brand" }, ...brandOptions];

  return [
    columnHelper.accessor("task_name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Task Name" />,
      meta: { label: "Task Name", width: "lg" },
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.task_name}
          onDraftChange={(next) => rowEditing.setDraftField("task_name", next)}
        />
      ),
    }),
    columnHelper.accessor("season_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Season" />,
      meta: { label: "Season", width: "md" },
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
    columnHelper.accessor("brand_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brand" />,
      meta: { label: "Brand", width: "md" },
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
    columnHelper.accessor("key_stage_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Key Stage" />,
      meta: { label: "Key Stage", width: "md" },
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
    columnHelper.accessor("gender", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gender" />,
      meta: { label: "Gender", width: "xs" },
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
    columnHelper.accessor("due_date", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
      meta: { label: "Due Date", width: "md" },
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
    // Display, not accessor: owners are rows in task_participants, not a column on the task,
    // so there's nothing to sort on and no single value an inline select could edit. Owners
    // are changed in the detail drawer, where the full add/remove list fits.
    columnHelper.display({
      id: "owners",
      header: "Owners",
      meta: { label: "Owners", width: "sm" },
      cell: ({ row }) => <PartyStack parties={taskOwners(row.original)} showSoleName />,
    }),
    columnHelper.display({
      id: "people",
      header: "People Involved",
      meta: { label: "People Involved", width: "sm" },
      cell: ({ row }) => <PartyStack parties={taskPeopleInvolved(row.original)} />,
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status", width: "sm" },
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
    // "Comments" is this row's own free-text `notes` field, not a threaded/counted feed —
    // shown as a truncated preview rather than a fabricated count.
    columnHelper.accessor("notes", {
      header: "Comments",
      meta: { label: "Comments", width: "lg" },
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
                      // key_stage_id's "not set" sentinel is "none", not "" — see
                      // keyStageEditOptions above.
                      field === "key_stage_id" ? (task.key_stage_id ?? "none") : (task[field] ?? ""),
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
