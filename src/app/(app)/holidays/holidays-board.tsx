"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createHolidayColumns } from "@/app/(app)/holidays/columns";
import { updateHoliday } from "@/app/(app)/holidays/_actions";
import { HOLIDAYS_QUERY_STATE } from "@/app/(app)/holidays/query-state";
import type { Holiday } from "@/data/holidays";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface HolidaysBoardProps {
  holidays: Holiday[];
  rowCount: number;
  canManage: boolean;
  countryOptions: DataTableFilterOption[];
}

export const HolidaysBoard = ({ holidays, rowCount, canManage, countryOptions }: HolidaysBoardProps) => {
  const queryState = useDataTableQueryState(HOLIDAYS_QUERY_STATE);
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirmEdit(holiday: Holiday) {
    setIsSaving(true);
    const result = await updateHoliday(holiday.id, rowEditing.draft);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${holiday.name} updated`);
    rowEditing.stopEditing();
  }

  const holidayColumns = useMemo(
    () => createHolidayColumns({ canManage, rowEditing, isSaving, onConfirmEdit: handleConfirmEdit }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, rowEditing.editingId, rowEditing.draft, isSaving]
  );

  return (
    <DataTable
      columns={holidayColumns}
      data={holidays}
      queryState={queryState}
      rowCount={rowCount}
      enableColumnFilterRow={false}
      paginationLabel="holidays"
      toolbar={{
        filters: [{ columnId: "country", title: "Country", placeholder: "Country", options: countryOptions }],
        sortOptions: [
          { columnId: "holiday_date", desc: false, label: "Date (Earliest)" },
          { columnId: "holiday_date", desc: true, label: "Date (Latest)" },
          { columnId: "name", desc: false, label: "Event Name (A-Z)" },
        ],
        searchColumnId: "name",
        searchPlaceholder: "Search holidays...",
      }}
    />
  );
};
