"use client";

import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createSeasonColumns } from "@/app/(app)/seasons/columns";
import { updateSeason } from "@/app/(app)/seasons/_actions";
import { SelectedSeasonPanel } from "@/app/(app)/seasons/selected-season-panel";
import { UpcomingSeasonsPanel } from "@/app/(app)/seasons/upcoming-seasons-panel";
import { SEASON_STATUS_CONFIG } from "@/constants/season-status";
import type { Season } from "@/data/seasons";

interface SeasonsBoardProps {
  seasons: Season[];
  canManage: boolean;
}

export const SeasonsBoard = ({ seasons, canManage }: SeasonsBoardProps) => {
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
  const upcomingSeasons = useMemo(() => seasons.filter((season) => season.status === "upcoming").slice(0, 4), [seasons]);

  const ownerOptions = useMemo(() => {
    const names = seasons
      .map((season) => season.owner?.full_name ?? season.owner?.email)
      .filter((name): name is string => !!name);
    return [...new Set(names)].map((name) => ({ label: name, value: name }));
  }, [seasons]);

  const yearOptions = useMemo(() => {
    const years = seasons.map((season) => new Date(season.start_date).getFullYear().toString());
    return [...new Set(years)]
      .sort()
      .map((year) => ({ label: year, value: year }));
  }, [seasons]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <DataTable
        columns={seasonColumns}
        data={seasons}
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
            { columnId: "ownerName", title: "Owner", placeholder: "Owner", options: ownerOptions },
            { columnId: "start_date", title: "Year", placeholder: "Year", options: yearOptions },
          ],
          searchColumnId: "season_code",
          searchPlaceholder: "Search seasons...",
          actions: (
            <>
              {/* Brands aren't built yet — placeholder only, not wired to a real filter. */}
              <Select disabled>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent />
              </Select>
              <Button variant="link" className="px-1 text-primary">
                <Filter />
                Filter
              </Button>
            </>
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
