"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { EditableCell } from "@/components/shared/editable-cell";
import { RowEditToggle } from "@/components/shared/row-edit-toggle";
import type { RowEditingState } from "@/components/data-table/use-row-editing";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { ExternalLinkRowActions } from "@/app/(app)/external-links/external-link-row-actions";
import type { ExternalLink } from "@/data/external-links";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, ExternalLink>();

const EDITABLE_FIELDS = ["title", "description", "url"] as const;

interface CreateExternalLinkColumnsOptions {
  canManage: boolean;
  canDelete: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (link: ExternalLink) => void;
}

export function createExternalLinkColumns({
  canManage,
  canDelete,
  rowEditing,
  isSaving,
  onConfirmEdit,
}: CreateExternalLinkColumnsOptions) {
  return [
    columnHelper.accessor("title", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      meta: { label: "Title", width: "md" },
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.title}
          onDraftChange={(next) => rowEditing.setDraftField("title", next)}
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
    columnHelper.accessor("url", {
      header: "Link",
      meta: { label: "Link", width: "lg" },
      enableSorting: false,
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.url}
          onDraftChange={(next) => rowEditing.setDraftField("url", next)}
          // Read mode is the whole point of this page: the cell IS the link. `noopener` because
          // the target document gets a handle on this window otherwise, and stopPropagation so
          // following a link never also triggers the row's own click handling.
          display={
            <a
              href={getValue()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"
            >
              <span className="truncate">{getValue()}</span>
              <ExternalLinkIcon className="size-3.5 shrink-0" />
            </a>
          }
        />
      ),
    }),
    columnHelper.accessor("created_at", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Added On" />,
      meta: { label: "Added On", width: "sm" },
      sortFn: "datetime",
      cell: ({ getValue }) => formatDate(getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right", width: "xs" },
      cell: ({ row }) => {
        if (!canManage && !canDelete) return null;
        const link = row.original;
        const editing = rowEditing.isEditing(link.id);

        return (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            {canManage ? (
              <RowEditToggle
                isEditing={editing}
                isSaving={editing && isSaving}
                onEdit={() => {
                  const initialDraft = Object.fromEntries(
                    EDITABLE_FIELDS.map((field) => [field, link[field] ?? ""])
                  );
                  rowEditing.startEditing(link.id, initialDraft);
                }}
                onConfirm={() => onConfirmEdit(link)}
              />
            ) : null}
            {canDelete ? <ExternalLinkRowActions linkId={link.id} linkTitle={link.title} /> : null}
          </div>
        );
      },
    }),
  ];
}
