"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createSeasonColumns } from "@/app/(app)/seasons/columns";
import { updateSeason } from "@/app/(app)/seasons/_actions";
import { SelectedSeasonPanel } from "@/app/(app)/seasons/selected-season-panel";
import { UpcomingSeasonsPanel } from "@/app/(app)/seasons/upcoming-seasons-panel";
import { SEASONS_QUERY_STATE } from "@/app/(app)/seasons/query-state";
import { SEASON_STATUS_CONFIG } from "@/constants/season-status";
import type { Season, SeasonTaskStats, listUpcomingSeasons } from "@/data/seasons";

interface SeasonsBoardProps {
  seasons: Season[];
  rowCount: number;
  canManage: boolean;
  upcomingSeasons: Awaited<ReturnType<typeof listUpcomingSeasons>>;
  seasonStats: Record<string, SeasonTaskStats>;
}

export const SeasonsBoard = ({
  seasons,
  rowCount,
  canManage,
  upcomingSeasons,
  seasonStats,
}: SeasonsBoardProps) => {
  const queryState = useDataTableQueryState(SEASONS_QUERY_STATE);
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirmEdit(season: Season) {
    setIsSaving(true);
    const result = await updateSeason(season.id, rowEditing.draft);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${season.season} updated`);
    rowEditing.stopEditing();
  }

  // Same resizable grid as Tasks — see tasks-board.tsx and columns.tsx's `isResized`.
  const [isColumnsResized, setIsColumnsResized] = useState(false);

  const seasonColumns = useMemo(
    () =>
      createSeasonColumns({
        canManage,
        rowEditing,
        isSaving,
        onConfirmEdit: handleConfirmEdit,
        seasonStats,
        isResized: isColumnsResized,
      }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, rowEditing.editingId, rowEditing.draft, isSaving, seasonStats, isColumnsResized]
  );
  const [selectedId, setSelectedId] = useState(seasons[0]?.id);
  const selectedSeason = seasons.find((season) => season.id === selectedId) ?? seasons[0];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <DataTable
        columns={seasonColumns}
        data={seasons}
        queryState={queryState}
        rowCount={rowCount}
        onRowClick={(season) => setSelectedId(season.id)}
        getRowClassName={(season) => (season.id === selectedId ? "bg-surface-selected" : undefined)}
        enableColumnFilterRow={false}
        enableColumnResizing
        resizeStorageKey="seasons-column-widths"
        onResizedChange={setIsColumnsResized}
        paginationLabel="seasons"
        toolbar={{
          filters: [
            {
              columnId: "status",
              title: "Season Status",
              placeholder: "Season Status",
              options: Object.entries(SEASON_STATUS_CONFIG).map(([value, { label }]) => ({ value, label })),
            },
          ],
          sortOptions: [
            { columnId: "season", desc: false, label: "Season (A-Z)" },
            { columnId: "season", desc: true, label: "Season (Z-A)" },
          ],
          searchColumnId: "season",
          searchPlaceholder: "Search seasons...",
        }}
      />
      {selectedSeason ? (
        <div className="flex flex-col gap-4">
          <SelectedSeasonPanel season={selectedSeason} />
          <UpcomingSeasonsPanel seasons={upcomingSeasons} />
        </div>
      ) : null}
    </div>
  );
};
