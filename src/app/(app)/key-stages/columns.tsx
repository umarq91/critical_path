"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { EditableCell } from "@/components/shared/editable-cell";
import { RowEditToggle } from "@/components/shared/row-edit-toggle";
import type { RowEditingState } from "@/components/data-table/use-row-editing";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { KeyStageRowActions } from "@/app/(app)/key-stages/key-stage-row-actions";
import type { KeyStage } from "@/data/key-stages";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, KeyStage>();

const EDITABLE_FIELDS = ["name", "description"] as const;

interface CreateKeyStageColumnsOptions {
  canManage: boolean;
  canDelete: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (keyStage: KeyStage) => void;
}

export function createKeyStageColumns({
  canManage,
  canDelete,
  rowEditing,
  isSaving,
  onConfirmEdit,
}: CreateKeyStageColumnsOptions) {
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
        const keyStage = row.original;
        const editing = rowEditing.isEditing(keyStage.id);

        return (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            {canManage ? (
              <RowEditToggle
                isEditing={editing}
                isSaving={editing && isSaving}
                onEdit={() => {
                  const initialDraft = Object.fromEntries(
                    EDITABLE_FIELDS.map((field) => [field, keyStage[field] ?? ""])
                  );
                  rowEditing.startEditing(keyStage.id, initialDraft);
                }}
                onConfirm={() => onConfirmEdit(keyStage)}
              />
            ) : null}
            {canDelete ? <KeyStageRowActions keyStageId={keyStage.id} keyStageName={keyStage.name} /> : null}
          </div>
        );
      },
    }),
  ];
}
