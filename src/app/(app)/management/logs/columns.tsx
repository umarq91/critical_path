"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditChangeSummary } from "@/app/(app)/management/logs/audit-change-summary";
import { AUDIT_ACTION_CONFIG } from "@/constants/audit";
import { getVizColorForId } from "@/constants/chart-colors";
import { formatDateTime } from "@/lib/dates";
import { initials } from "@/lib/utils";
import type { AuditEvent } from "@/data/audit-log";

const columnHelper = createColumnHelper<typeof dataTableFeatures, AuditEvent>();

// How many field changes fit in a row before the rest moves behind the detail dialog. Two keeps
// every row the same height for the common single-field inline edit.
const INLINE_CHANGE_LIMIT = 2;

export function createAuditLogColumns() {
  return [
    columnHelper.accessor("created_at", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="When" />,
      meta: { label: "When" },
      sortFn: "datetime",
      cell: ({ getValue }) => <span className="whitespace-nowrap text-body">{formatDateTime(getValue())}</span>,
    }),
    // An accessor on actor_id rather than a display column, even though the cell renders from
    // the embedded profile: the toolbar's "People" filter targets this column by id, and only
    // an accessor column carries a filter value through to the query state.
    columnHelper.accessor("actor_id", {
      id: "actor",
      header: "Person",
      meta: { label: "Person" },
      enableSorting: false,
      cell: ({ row }) => {
        const { actor, actor_email } = row.original;
        // actor_email is the snapshot taken when the entry was written — it's all that's left
        // once the profile is deleted, and the profile FK goes null rather than taking the
        // history with it (0020).
        const name = actor?.full_name ?? actor?.email ?? actor_email ?? "Deleted user";
        const email = actor?.email ?? actor_email;

        return (
          <div className="flex items-center gap-2.5">
            <Avatar size="sm" className="shrink-0">
              <AvatarImage src={actor?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="text-white" style={{ backgroundColor: getVizColorForId(actor?.id ?? name) }}>
                {actor ? initials(name, name) : <Building2 className="size-3.5" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body-strong text-foreground">{name}</span>
              {email && email !== name ? (
                <span className="truncate text-sm text-muted-foreground">{email}</span>
              ) : null}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("action", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
      meta: { label: "Action" },
      cell: ({ getValue }) => <StatusBadge value={getValue()} config={AUDIT_ACTION_CONFIG} />,
    }),
    columnHelper.accessor("entity_label", {
      header: "Task",
      meta: { label: "Task" },
      // Not sortable: entity_label is a snapshot of the name at the time, so ordering by it
      // groups nothing meaningful — the log is read chronologically.
      enableSorting: false,
      cell: ({ row, getValue }) => (
        <div className="flex flex-col">
          <span className="text-body-strong text-foreground">{getValue() ?? "Untitled"}</span>
          <span className="text-sm text-muted-foreground capitalize">{row.original.entity_type}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "details",
      header: "Details",
      meta: { label: "Details" },
      cell: ({ row }) => <AuditChangeSummary changes={row.original.changes} limit={INLINE_CHANGE_LIMIT} />,
    }),
  ];
}
