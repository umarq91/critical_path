"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createDepartmentColumns } from "@/app/(app)/departments/columns";
import { updateDepartment } from "@/app/(app)/departments/_actions";
import type { Department } from "@/data/departments";

interface DepartmentsBoardProps {
  departments: Department[];
  rowCount: number;
  canManage: boolean;
  canDelete: boolean;
}

export const DepartmentsBoard = ({ departments, rowCount, canManage, canDelete }: DepartmentsBoardProps) => {
  const queryState = useDataTableQueryState({ defaultPageSize: 15, defaultSort: { id: "name", desc: false } });
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirmEdit(department: Department) {
    setIsSaving(true);
    const result = await updateDepartment(department.id, rowEditing.draft);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${department.name} updated`);
    rowEditing.stopEditing();
  }

  const departmentColumns = useMemo(
    () => createDepartmentColumns({ canManage, canDelete, rowEditing, isSaving, onConfirmEdit: handleConfirmEdit }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, canDelete, rowEditing.editingId, rowEditing.draft, isSaving]
  );

  return (
    <DataTable
      columns={departmentColumns}
      data={departments}
      queryState={queryState}
      rowCount={rowCount}
      enableColumnFilterRow={false}
      paginationLabel="departments"
    />
  );
};
