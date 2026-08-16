"use client";

import { MoreVertical, Pencil } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { SEASON_STATUS_CONFIG } from "@/constants/season-status";
import { cn } from "@/lib/utils";
import type { Season } from "@/data/seasons";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Season>();

const OWNER_COLORS = ["bg-viz-1", "bg-viz-2", "bg-viz-5", "bg-viz-6"];

function ownerColor(name: string) {
  return OWNER_COLORS[name.charCodeAt(0) % OWNER_COLORS.length];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export const seasonColumns = [
  columnHelper.accessor("season_code", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Season Code" />,
    meta: { label: "Season Code", filterVariant: "text", filterPlaceholder: "Search seasons..." },
    filterFn: "includesString",
  }),
  columnHelper.accessor("season_name", {
    header: "Season Name",
    meta: { label: "Season Name" },
    enableSorting: false,
  }),
  columnHelper.accessor("status", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    meta: {
      label: "Status",
      filterVariant: "select",
      filterPlaceholder: "Season Status",
      filterOptions: Object.entries(SEASON_STATUS_CONFIG).map(([value, { label }]) => ({ value, label })),
    },
    filterFn: "weakEquals",
    cell: ({ getValue }) => <StatusBadge value={getValue()} config={SEASON_STATUS_CONFIG} />,
  }),
  columnHelper.accessor("start_date", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
    meta: { label: "Start Date" },
    sortFn: "datetime",
    // Doubles as the Year filter's target column — matches the year portion of the date
    // rather than the raw string, since there's no separate `year` column to filter on.
    filterFn: (row, _columnId, filterValue) => new Date(row.original.start_date).getFullYear().toString() === filterValue,
    cell: ({ getValue }) => formatDate(getValue()),
  }),
  columnHelper.accessor("end_date", {
    header: "End Date",
    meta: { label: "End Date" },
    enableSorting: false,
    cell: ({ getValue }) => formatDate(getValue()),
  }),
  // Brands/Tasks/Completion % are shown on the mockup but have no real source yet —
  // both come from `tasks` (and brands<->season association) once those exist. Rendered
  // as "—" rather than fabricated numbers; wire these up when data/tasks.ts lands.
  columnHelper.display({
    id: "brands",
    header: "Brands",
    meta: { label: "Brands" },
    cell: () => <span className="text-muted-foreground">—</span>,
  }),
  columnHelper.display({
    id: "tasks",
    header: "Tasks",
    meta: { label: "Tasks" },
    cell: () => <span className="text-muted-foreground">—</span>,
  }),
  columnHelper.display({
    id: "completion",
    header: "Completion %",
    meta: { label: "Completion %" },
    cell: () => <span className="text-muted-foreground">—</span>,
  }),
  columnHelper.accessor((row) => row.owner?.full_name ?? row.owner?.email ?? "", {
    id: "ownerName",
    header: "Owner",
    meta: { label: "Owner", filterVariant: "select", filterPlaceholder: "Owner" },
    filterFn: "weakEquals",
    enableSorting: false,
    cell: ({ getValue }) => {
      const name = getValue();
      if (!name) return <span className="text-muted-foreground">Unassigned</span>;
      return (
        <span className="flex items-center gap-2">
          <span className={cn("size-6 shrink-0 rounded-full", ownerColor(name))} />
          {name}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    meta: { label: "Actions" },
    cell: () => (
      <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
        <Button variant="ghost" size="icon">
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon">
          <MoreVertical />
        </Button>
      </div>
    ),
  }),
];
