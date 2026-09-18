"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { ColorTag } from "@/components/shared/color-tag";
import { EditableCell } from "@/components/shared/editable-cell";
import { RowEditToggle } from "@/components/shared/row-edit-toggle";
import type { RowEditingState } from "@/components/data-table/use-row-editing";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { getVizColorForId } from "@/constants/chart-colors";
import { HolidayRowActions } from "@/app/(app)/holidays/holiday-row-actions";
import type { Holiday } from "@/data/holidays";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Holiday>();

const EDITABLE_FIELDS = ["holiday_date", "name", "description", "country"] as const;

interface CreateHolidayColumnsOptions {
  canManage: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (holiday: Holiday) => void;
}

export function createHolidayColumns({ canManage, rowEditing, isSaving, onConfirmEdit }: CreateHolidayColumnsOptions) {
  return [
    columnHelper.accessor("holiday_date", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      meta: { label: "Date", width: "sm" },
      sortFn: "datetime",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={formatDate(getValue())}
          variant="date"
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.holiday_date}
          onDraftChange={(next) => rowEditing.setDraftField("holiday_date", next)}
        />
      ),
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Event Name" />,
      meta: { label: "Event Name", width: "md" },
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
      meta: { label: "Description", width: "lg" },
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
    columnHelper.accessor("country", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
      meta: { label: "Country", width: "xs" },
      filterFn: "weakEquals",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          // A deterministic, not stored, colour — country is open text with no colour column
          // of its own (see 0027_public_holidays.sql), so this is the same "no stored colour"
          // fallback getVizColorForId already exists for.
          display={<ColorTag label={getValue()} color={getVizColorForId(getValue())} />}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.country}
          onDraftChange={(next) => rowEditing.setDraftField("country", next)}
        />
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right", width: "xs" },
      cell: ({ row }) => {
        if (!canManage) return null;
        const holiday = row.original;
        const editing = rowEditing.isEditing(holiday.id);

        return (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <RowEditToggle
              isEditing={editing}
              isSaving={editing && isSaving}
              onEdit={() => {
                const initialDraft: Record<string, string | string[]> = Object.fromEntries(
                  EDITABLE_FIELDS.map((field) => [field, holiday[field] ?? ""])
                );
                rowEditing.startEditing(holiday.id, initialDraft);
              }}
              onConfirm={() => onConfirmEdit(holiday)}
            />
            <HolidayRowActions holidayId={holiday.id} holidayName={holiday.name} />
          </div>
        );
      },
    }),
  ];
}
