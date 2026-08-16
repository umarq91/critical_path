"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createSeasonColumns } from "@/app/(app)/seasons/columns";
import { updateSeason } from "@/app/(app)/seasons/_actions";
import { SelectedSeasonPanel } from "@/app/(app)/seasons/selected-season-panel";
import { UpcomingSeasonsPanel } from "@/app/(app)/seasons/upcoming-seasons-panel";
import { SEASON_STATUS_CONFIG } from "@/constants/season-status";
import type { DataTableFilterOption } from "@/components/data-table/table-features";
import type { Season, listUpcomingSeasons } from "@/data/seasons";

interface SeasonsBoardProps {
  seasons: Season[];
  rowCount: number;
  canManage: boolean;
  ownerOptions: DataTableFilterOption[];
  yearOptions: string[];
  upcomingSeasons: Awaited<ReturnType<typeof listUpcomingSeasons>>;
}

export const SeasonsBoard = ({
  seasons,
  rowCount,
  canManage,
  ownerOptions,
  yearOptions,
  upcomingSeasons,
}: SeasonsBoardProps) => {
  const queryState = useDataTableQueryState({ defaultPageSize: 10, defaultSort: { id: "start_date", desc: false } });
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
    toast.success(`${season.season_name} updated`);
    rowEditing.stopEditing();
  }

  const seasonColumns = useMemo(
    () => createSeasonColumns({ canManage, rowEditing, isSaving, onConfirmEdit: handleConfirmEdit }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, rowEditing.editingId, rowEditing.draft, isSaving]
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
        getRowClassName={(season) => (season.id === selectedId ? "bg-primary-tint/40" : undefined)}
        enableColumnFilterRow={false}
        paginationLabel="seasons"
        toolbar={{
          filters: [
            {
              columnId: "status",
              title: "Season Status",
              placeholder: "Season Status",
              options: Object.entries(SEASON_STATUS_CONFIG).map(([value, { label }]) => ({ value, label })),
            },
            { columnId: "owner_id", title: "Owner", placeholder: "Owner", options: ownerOptions },
            {
              columnId: "start_date",
              title: "Year",
              placeholder: "Year",
              options: yearOptions.map((year) => ({ label: year, value: year })),
            },
          ],
          sortOptions: [
            { columnId: "season_name", desc: false, label: "Season Name (A-Z)" },
            { columnId: "season_name", desc: true, label: "Season Name (Z-A)" },
            { columnId: "start_date", desc: false, label: "Start Date (Earliest)" },
            { columnId: "start_date", desc: true, label: "Start Date (Latest)" },
          ],
          searchColumnId: "season_code",
          searchPlaceholder: "Search seasons...",
          // Brands aren't built yet — placeholder only, not wired to a real filter.
          actions: (
            <Select disabled>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent />
            </Select>
          ),
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
