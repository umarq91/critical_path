"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EditableCell } from "@/components/shared/editable-cell";
import { RowEditToggle } from "@/components/shared/row-edit-toggle";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import type { RowEditingState } from "@/components/data-table/use-row-editing";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { SEASON_STATUS_CONFIG } from "@/constants/season-status";
import { SeasonRowActions } from "@/app/(app)/seasons/season-row-actions";
import { cn } from "@/lib/utils";
import type { Season, SeasonTaskStats } from "@/data/seasons";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Season>();

const OWNER_COLORS = ["bg-viz-1", "bg-viz-2", "bg-viz-5", "bg-viz-6"];
const STATUS_OPTIONS = Object.entries(SEASON_STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
const EDITABLE_FIELDS = ["season_name", "status", "start_date", "end_date"] as const;

function ownerColor(name: string) {
  return OWNER_COLORS[name.charCodeAt(0) % OWNER_COLORS.length];
}

interface CreateSeasonColumnsOptions {
  canManage: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (season: Season) => void;
  seasonStats: Record<string, SeasonTaskStats>;
}

// canManage gates inline editing + the row actions — computed once per page render from
// can(role, "admin.manage_lookups"), same permission the Server Actions enforce.
export function createSeasonColumns({
  canManage,
  rowEditing,
  isSaving,
  onConfirmEdit,
  seasonStats,
}: CreateSeasonColumnsOptions) {
  return [
    // Not inline-editable, unlike the columns below: it's the stable code other systems
    // key off (Databricks spec, filters), so changing it is deliberately a bit more
    // friction than a click — left for a future dedicated edit flow.
    columnHelper.accessor("season_code", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Season Code" />,
      meta: { label: "Season Code" },
      filterFn: "includesString",
    }),
    columnHelper.accessor("season_name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Season Name" />,
      meta: { label: "Season Name" },
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.season_name}
          onDraftChange={(next) => rowEditing.setDraftField("season_name", next)}
        />
      ),
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status" },
      filterFn: "weakEquals",
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={<StatusBadge value={getValue()} config={SEASON_STATUS_CONFIG} />}
          variant="select"
          options={STATUS_OPTIONS}
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.status}
          onDraftChange={(next) => rowEditing.setDraftField("status", next)}
        />
      ),
    }),
    columnHelper.accessor("start_date", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
      meta: { label: "Start Date" },
      sortFn: "datetime",
      // Doubles as the Year filter's target column — matches the year portion of the date
      // rather than the raw string, since there's no separate `year` column to filter on.
      filterFn: (row, _columnId, filterValue) =>
        new Date(row.original.start_date).getFullYear().toString() === filterValue,
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={formatDate(getValue())}
          variant="date"
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.start_date}
          onDraftChange={(next) => rowEditing.setDraftField("start_date", next)}
        />
      ),
    }),
    columnHelper.accessor("end_date", {
      header: "End Date",
      meta: { label: "End Date" },
      enableSorting: false,
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={formatDate(getValue())}
          variant="date"
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.end_date}
          onDraftChange={(next) => rowEditing.setDraftField("end_date", next)}
        />
      ),
    }),
    columnHelper.display({
      id: "brands",
      header: "Brands",
      meta: { label: "Brands" },
      cell: ({ row }) => seasonStats[row.original.id]?.brandsCount ?? 0,
    }),
    columnHelper.display({
      id: "tasks",
      header: "Tasks",
      meta: { label: "Tasks" },
      cell: ({ row }) => seasonStats[row.original.id]?.tasksCount ?? 0,
    }),
    columnHelper.display({
      id: "completion",
      header: "Completion %",
      meta: { label: "Completion %" },
      cell: ({ row }) => {
        const stats = seasonStats[row.original.id];
        const pct = stats && stats.tasksCount > 0 ? Math.round((stats.completedCount / stats.tasksCount) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <ProgressPrimitive.Root value={pct} className="w-24">
              <ProgressTrack className="h-2">
                <ProgressIndicator style={{ backgroundColor: row.original.color }} />
              </ProgressTrack>
            </ProgressPrimitive.Root>
            <span className="text-sm text-muted-foreground">{pct}%</span>
          </div>
        );
      },
    }),
    // Filters on owner_id (a stable id the server can query directly), not the derived
    // display name — filtering is server-side now, so it needs a real column to match on.
    columnHelper.accessor((row) => row.owner_id ?? "", {
      id: "owner_id",
      header: "Owner",
      meta: { label: "Owner" },
      enableSorting: false,
      cell: ({ row }) => {
        const owner = row.original.owner;
        if (!owner) return <span className="text-muted-foreground">Unassigned</span>;
        const name = owner.full_name ?? owner.email;
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
      meta: { label: "Actions", sticky: "right" },
      cell: ({ row }) => {
        if (!canManage) return null;
        const season = row.original;
        const editing = rowEditing.isEditing(season.id);

        return (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <RowEditToggle
              isEditing={editing}
              isSaving={editing && isSaving}
              onEdit={() => {
                const initialDraft = Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, season[field]]));
                rowEditing.startEditing(season.id, initialDraft);
              }}
              onConfirm={() => onConfirmEdit(season)}
            />
            <SeasonRowActions seasonId={season.id} seasonName={season.season_name} />
          </div>
        );
      },
    }),
  ];
}
