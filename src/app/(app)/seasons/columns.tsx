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
import type { Season, SeasonTaskStats } from "@/data/seasons";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Season>();

const STATUS_OPTIONS = Object.entries(SEASON_STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
const EDITABLE_FIELDS = ["status", "start_date", "end_date", "color"] as const;

interface CreateSeasonColumnsOptions {
  canManage: boolean;
  rowEditing: RowEditingState;
  isSaving: boolean;
  onConfirmEdit: (season: Season) => void;
  seasonStats: Record<string, SeasonTaskStats>;
  /** Whether the person has dragged a column yet — headers only wrap once true. Same as
   *  tasks/columns.tsx's `isResized`. */
  isResized: boolean;
}

// canManage gates inline editing + the row actions — computed once per page render from
// can(role, "admin.manage_lookups"), same permission the Server Actions enforce.
export function createSeasonColumns({
  canManage,
  rowEditing,
  isSaving,
  onConfirmEdit,
  seasonStats,
  isResized,
}: CreateSeasonColumnsOptions) {
  return [
    // Not inline-editable: it's the stable value other systems key off (Databricks spec,
    // filters, CSV import), so changing it is deliberately a bit more friction than a click —
    // left for a future dedicated edit flow.
    columnHelper.accessor("season", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Season" wrap={isResized} />,
      meta: { label: "Season", width: "sm" },
      size: 200,
      minSize: 120,
      filterFn: "includesString",
    }),
    columnHelper.accessor("color", {
      header: "Colour",
      meta: { label: "Colour", width: "xs" },
      size: 90,
      minSize: 70,
      enableSorting: false,
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          display={<span className="inline-block size-5 rounded-full" style={{ backgroundColor: getValue() }} />}
          variant="color"
          isEditing={rowEditing.isEditing(row.original.id)}
          draftValue={rowEditing.draft.color}
          onDraftChange={(next) => rowEditing.setDraftField("color", next)}
        />
      ),
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" wrap={isResized} />,
      meta: { label: "Status", width: "sm" },
      size: 130,
      minSize: 90,
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" wrap={isResized} />,
      meta: { label: "Start Date", width: "sm" },
      size: 130,
      minSize: 100,
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
      meta: { label: "End Date", width: "sm" },
      size: 130,
      minSize: 100,
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
      meta: { label: "Brands", width: "xs" },
      size: 90,
      minSize: 70,
      cell: ({ row }) => seasonStats[row.original.id]?.brandsCount ?? 0,
    }),
    columnHelper.display({
      id: "tasks",
      header: "Tasks",
      meta: { label: "Tasks", width: "xs" },
      size: 90,
      minSize: 70,
      cell: ({ row }) => seasonStats[row.original.id]?.tasksCount ?? 0,
    }),
    columnHelper.display({
      id: "completion",
      header: "Completion %",
      meta: { label: "Completion %", width: "sm" },
      size: 150,
      minSize: 110,
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
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right", width: "xs" },
      size: 110,
      minSize: 90,
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
            <SeasonRowActions seasonId={season.id} season={season.season} />
          </div>
        );
      },
    }),
  ];
}
