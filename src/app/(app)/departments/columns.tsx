"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { EditableCell } from "@/components/shared/editable-cell";
import { RowEditToggle } from "@/components/shared/row-edit-toggle";
import type { RowEditingState } from "@/components/data-table/use-row-editing";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { DepartmentRowActions } from "@/app/(app)/departments/department-row-actions";
import type { Department } from "@/data/departments";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Department>();

const EDITABLE_FIELDS = ["name", "description"] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

interface CreateDepartmentColumnsOptions {
  canManage: boolean;
  canDelete: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (department: Department) => void;
}

export function createDepartmentColumns({
  canManage,
  canDelete,
  rowEditing,
  isSaving,
  onConfirmEdit,
}: CreateDepartmentColumnsOptions) {
  return [
    columnHelper.accessor("name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      meta: { label: "Name" },
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.name}
          onDraftChange={(next) => rowEditing.setDraftField("name", next)}
        />
      ),
    }),
    columnHelper.accessor("description", {
      header: "Description",
      meta: { label: "Description" },
      enableSorting: false,
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue() ?? ""}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.description}
          onDraftChange={(next) => rowEditing.setDraftField("description", next)}
        />
      ),
    }),
    columnHelper.accessor("created_at", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created On" />,
      meta: { label: "Created On" },
      sortFn: "datetime",
      cell: ({ getValue }) => formatDate(getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right" },
      cell: ({ row }) => {
        if (!canManage && !canDelete) return null;
        const department = row.original;
        const editing = rowEditing.isEditing(department.id);

        return (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            {canManage ? (
              <RowEditToggle
                isEditing={editing}
                isSaving={editing && isSaving}
                onEdit={() => {
                  const initialDraft = Object.fromEntries(
                    EDITABLE_FIELDS.map((field) => [field, department[field] ?? ""])
                  );
                  rowEditing.startEditing(department.id, initialDraft);
                }}
                onConfirm={() => onConfirmEdit(department)}
              />
            ) : null}
            {canDelete ? (
              <DepartmentRowActions departmentId={department.id} departmentName={department.name} />
            ) : null}
          </div>
        );
      },
    }),
  ];
}
