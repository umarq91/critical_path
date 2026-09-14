"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { EmptyState } from "@/components/shared/empty-state";
import { createTrashColumns } from "@/app/(app)/tasks/trash/columns";
import type { DeletedTask } from "@/data/tasks";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface TrashBoardProps {
  tasks: DeletedTask[];
  rowCount: number;
  canRestore: boolean;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
}

// Newest-deleted first — matches listDeletedTasks' own default order, and is the only sort a
// trash is ever browsed by ("what did I just remove").
const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "deleted_at", desc: true } };

export const TrashBoard = ({ tasks, rowCount, canRestore, seasonOptions, brandOptions }: TrashBoardProps) => {
  const queryState = useDataTableQueryState(QUERY_STATE_OPTIONS);
  const columns = useMemo(() => createTrashColumns({ canRestore }), [canRestore]);

  return (
    <DataTable
      columns={columns}
      data={tasks}
      queryState={queryState}
      rowCount={rowCount}
      paginationLabel="deleted tasks"
      emptyState={
        <EmptyState
          title="Trash is empty"
          description="Tasks removed from the grid land here and can be restored at any time."
        />
      }
      toolbar={{
        filters: [
          { columnId: "season_id", title: "Season", placeholder: "All Seasons", options: seasonOptions },
          { columnId: "brand_id", title: "Brand", placeholder: "All Brands", options: brandOptions },
        ],
        sortOptions: [
          { columnId: "deleted_at", desc: true, label: "Recently Deleted" },
          { columnId: "deleted_at", desc: false, label: "Oldest Deleted" },
        ],
        searchColumnId: "task_name",
        searchPlaceholder: "Search deleted tasks...",
      }}
    />
  );
};
