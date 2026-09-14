"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { StatusBadge } from "@/components/shared/status-badge";
import { ColorTag } from "@/components/shared/color-tag";
import { RestoreTaskButton } from "@/app/(app)/tasks/trash/restore-task-button";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { getVizColorForId } from "@/constants/chart-colors";
import { formatDateTime } from "@/lib/dates";
import { initials } from "@/lib/utils";
import type { DeletedTask } from "@/data/tasks";

const columnHelper = createColumnHelper<typeof dataTableFeatures, DeletedTask>();

interface CreateTrashColumnsOptions {
  canRestore: boolean;
}

// Read-only, unlike columns.tsx — a trashed row has nothing to inline-edit, only restore or
// leave alone, so there's no EditableCell/RowEditToggle machinery here.
export function createTrashColumns({ canRestore }: CreateTrashColumnsOptions) {
  return [
    columnHelper.accessor("task_name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Task Name" />,
      meta: { label: "Task Name", width: "lg" },
    }),
    columnHelper.accessor("season_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Season" />,
      meta: { label: "Season", width: "md" },
      filterFn: "weakEquals",
      cell: ({ row }) => {
        const season = row.original.season;
        return season ? <ColorTag label={season.season_name} color={season.color} /> : "—";
      },
    }),
    columnHelper.accessor("brand_id", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brand" />,
      meta: { label: "Brand", width: "md" },
      filterFn: "weakEquals",
      cell: ({ row }) => row.original.brand?.brand_name ?? <span className="text-muted-foreground">—</span>,
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status", width: "sm" },
      enableSorting: false,
      cell: ({ getValue }) => <StatusBadge value={getValue()} config={TASK_STATUS_CONFIG} />,
    }),
    // Not an accessor on deleted_by (the raw uuid) — the toolbar has no filter on this column,
    // and the cell renders entirely from the embedded profile, same reasoning as columns.tsx's
    // owners/people display columns.
    columnHelper.display({
      id: "deleted_by",
      header: "Deleted By",
      meta: { label: "Deleted By", width: "md" },
      cell: ({ row }) => {
        const profile = row.original.deleted_by_profile;
        if (!profile) return <span className="text-muted-foreground">—</span>;
        const name = profile.full_name ?? profile.email;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar size="sm" className="shrink-0">
              <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="text-white" style={{ backgroundColor: getVizColorForId(profile.id) }}>
                {initials(name, profile.email)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-body-strong text-foreground">{name}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor("deleted_at", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Deleted At" />,
      meta: { label: "Deleted At", width: "sm" },
      sortFn: "datetime",
      // deleted_at is only ever null for a row that has NO business being in this list — the
      // query filters `not null` — so the fallback below is defensive, not an expected path.
      cell: ({ getValue }) => {
        const value = getValue();
        return <span className="whitespace-nowrap text-body">{value ? formatDateTime(value) : "—"}</span>;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right", width: "xs" },
      cell: ({ row }) => {
        if (!canRestore) return null;
        return (
          <div onClick={(event) => event.stopPropagation()}>
            <RestoreTaskButton taskId={row.original.id} taskName={row.original.task_name} />
          </div>
        );
      },
    }),
  ];
}
