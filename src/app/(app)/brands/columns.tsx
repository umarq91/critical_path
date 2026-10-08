"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EditableCell } from "@/components/shared/editable-cell";
import { RowEditToggle } from "@/components/shared/row-edit-toggle";
import type { RowEditingState } from "@/components/data-table/use-row-editing";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { BRAND_STATUS_CONFIG } from "@/constants/brand-status";
import { BrandRowActions } from "@/app/(app)/brands/brand-row-actions";
import type { Brand } from "@/data/brands";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Brand>();

const STATUS_OPTIONS = Object.entries(BRAND_STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
const EDITABLE_FIELDS = ["brand_name", "status"] as const;

interface CreateBrandColumnsOptions {
  canManage: boolean;
  canDelete: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (brand: Brand) => void;
}

// canManage/canDelete come from can(role, "brand.manage"/"brand.delete") — Brands has its
// own granular row on the client's Role-Based Access screen, distinct from the general
// admin.manage_lookups bucket most other lookup entities still use.
export function createBrandColumns({
  canManage,
  canDelete,
  rowEditing,
  isSaving,
  onConfirmEdit,
}: CreateBrandColumnsOptions) {
  return [
    columnHelper.accessor("brand_name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brand Name" />,
      meta: { label: "Brand Name", width: "md" },
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={
            <span className="flex items-center gap-2">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: row.original.color }}
              >
                {getValue().charAt(0).toUpperCase()}
              </span>
              {getValue()}
            </span>
          }
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.brand_name}
          onDraftChange={(next) => rowEditing.setDraftField("brand_name", next)}
        />
      ),
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status", width: "sm" },
      filterFn: "weakEquals",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={<StatusBadge value={getValue()} config={BRAND_STATUS_CONFIG} />}
          variant="select"
          options={STATUS_OPTIONS}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.status}
          onDraftChange={(next) => rowEditing.setDraftField("status", next)}
        />
      ),
    }),
    // Tasks has no real source yet — comes from `tasks` (brand<->task association) once that
    // table exists. Rendered as "—" rather than a fabricated number.
    columnHelper.display({
      id: "tasks",
      header: "Tasks",
      meta: { label: "Tasks", width: "xs" },
      cell: () => <span className="text-muted-foreground">—</span>,
    }),
    columnHelper.accessor("created_at", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created On" />,
      meta: { label: "Created On", width: "sm" },
      sortFn: "datetime",
      cell: ({ getValue }) => formatDate(getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right", width: "xs" },
      cell: ({ row }) => {
        if (!canManage && !canDelete) return null;
        const brand = row.original;
        const editing = rowEditing.isEditing(brand.id);

        return (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            {canManage ? (
              <RowEditToggle
                isEditing={editing}
                isSaving={editing && isSaving}
                onEdit={() => {
                  rowEditing.startEditing(
                    brand.id,
                    Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, brand[field] ?? ""]))
                  );
                }}
                onConfirm={() => onConfirmEdit(brand)}
              />
            ) : null}
            {canDelete ? <BrandRowActions brandId={brand.id} brandName={brand.brand_name} /> : null}
          </div>
        );
      },
    }),
  ];
}
