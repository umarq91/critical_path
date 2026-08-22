"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { MessageSquare } from "lucide-react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ColorTag } from "@/components/shared/color-tag";
import { EditableCell } from "@/components/shared/editable-cell";
import { RowEditToggle } from "@/components/shared/row-edit-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RowEditingState } from "@/components/data-table/use-row-editing";
import { dataTableFeatures, type DataTableFilterOption } from "@/components/data-table/table-features";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { TASK_PRIORITY_CONFIG } from "@/constants/task-priority";
import { getVizColorForId } from "@/constants/chart-colors";
import { initials, cn } from "@/lib/utils";
import { TaskRowActions } from "@/app/(app)/tasks/task-row-actions";
import type { Task } from "@/data/tasks";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Task>();

const STATUS_OPTIONS = Object.entries(TASK_STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
const GENDER_OPTIONS = Object.entries(TASK_GENDER_CONFIG).map(([value, { label }]) => ({ value, label }));
const PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY_CONFIG).map(([value, { label }]) => ({ value, label }));
const EDITABLE_FIELDS = [
  "task_name",
  "season_id",
  "brand_id",
  "key_stage_id",
  "gender",
  "due_date",
  "assignee_id",
  "status",
  "priority",
  "notes",
] as const;

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

interface CreateTaskColumnsOptions {
  canManage: boolean;
  canDelete: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (task: Task) => void;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
  assigneeOptions: DataTableFilterOption[];
  /** Adds a read-only "People Involved" avatar-stack column after Owner/Assignee — off by
   *  default so the main Tasks grid (already dense at 11 columns) doesn't grow a 12th; the
   *  Upcoming Tasks page opts in since "who else is on this" matters more on a page scoped
   *  to tasks the current user owns or is merely involved in. */
  includePeopleColumn?: boolean;
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
  assigneeOptions,
  includePeopleColumn,
}: CreateTaskColumnsOptions) {
  // The inline-edit select needs an explicit "not set" choice since key_stage_id is
  // optional — the filter dropdown (passed separately by tasks-board.tsx) doesn't need one.
  // Sentinel is "none", not "" — EditableCell's Select ignores onValueChange when the new
  // value is falsy (its guard against Base UI firing a spurious empty value on close), so an
  // empty-string option would be unselectable; "none" is normalised back to null in _actions.ts.
  const keyStageEditOptions = [{ value: "none", label: "No key stage" }, ...keyStageOptions];

  return [
    columnHelper.accessor("task_name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Task Name" />,
      meta: { label: "Task Name" },
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
      meta: { label: "Season" },
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
      meta: { label: "Brand" },
      filterFn: "weakEquals",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.brand_id}
          display={row.original.brand?.brand_name ?? "—"}
          variant="select"
          options={brandOptions}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.brand_id}
          onDraftChange={(next) => rowEditing.setDraftField("brand_id", next)}
        />
      ),
    }),
    columnHelper.accessor("key_stage_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Key Stage" />,
      meta: { label: "Key Stage" },
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
      meta: { label: "Gender" },
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
      meta: { label: "Due Date" },
      sortFn: "datetime",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={
            <span className={cn(row.original.status === "overdue" && "font-medium text-status-overdue-text")}>
              {formatDate(getValue())}
            </span>
          }
          variant="date"
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.due_date}
          onDraftChange={(next) => rowEditing.setDraftField("due_date", next)}
        />
      ),
    }),
    columnHelper.accessor("assignee_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Owner / Assignee" />,
      meta: { label: "Owner / Assignee" },
      filterFn: "weakEquals",
      cell: ({ row }) => {
        const assignee = row.original.assignee;
        return (
          <EditableCell
            value={row.original.assignee_id ?? ""}
            display={
              assignee ? (
                <span className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarImage src={assignee.avatar_url ?? undefined} alt="" />
                    <AvatarFallback
                      className="text-white"
                      style={{ backgroundColor: getVizColorForId(assignee.id) }}
                    >
                      {initials(assignee.full_name, assignee.email)}
                    </AvatarFallback>
                  </Avatar>
                  {assignee.full_name ?? assignee.email}
                </span>
              ) : (
                "—"
              )
            }
            variant="select"
            options={assigneeOptions}
            isEditing={rowEditing.isEditing(row.original.id)}
            draftValue={rowEditing.draft.assignee_id}
            onDraftChange={(next) => rowEditing.setDraftField("assignee_id", next)}
          />
        );
      },
    }),
    ...(includePeopleColumn
      ? [
          columnHelper.display({
            id: "people",
            header: "People Involved",
            meta: { label: "People Involved" },
            cell: ({ row }) => {
              const people = row.original.people.map((link) => link.profile).filter((profile) => profile !== null);
              if (people.length === 0) return <span className="text-muted-foreground">—</span>;
              const visible = people.slice(0, 3);
              const overflow = people.length - visible.length;
              return (
                <div className="flex items-center -space-x-2">
                  {visible.map((person) => (
                    <Avatar key={person.id} size="sm" className="ring-2 ring-card">
                      <AvatarImage src={person.avatar_url ?? undefined} alt="" />
                      <AvatarFallback className="text-white" style={{ backgroundColor: getVizColorForId(person.id) }}>
                        {initials(person.full_name, person.email)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflow > 0 ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card">
                      +{overflow}
                    </span>
                  ) : null}
                </div>
              );
            },
          }),
        ]
      : []),
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status" },
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
    columnHelper.accessor("priority", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Priority" />,
      meta: { label: "Priority" },
      filterFn: "weakEquals",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={<StatusBadge value={getValue()} config={TASK_PRIORITY_CONFIG} />}
          variant="select"
          options={PRIORITY_OPTIONS}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.priority}
          onDraftChange={(next) => rowEditing.setDraftField("priority", next)}
        />
      ),
    }),
    // "Comments" is this row's own free-text `notes` field, not a threaded/counted feed —
    // shown as a truncated preview rather than a fabricated count.
    columnHelper.accessor("notes", {
      header: "Comments",
      meta: { label: "Comments" },
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
      meta: { label: "Actions", sticky: "right" },
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
