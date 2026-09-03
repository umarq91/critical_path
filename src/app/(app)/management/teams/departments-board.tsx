"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createDepartmentColumns } from "@/app/(app)/management/teams/columns";
import { updateDepartment } from "@/app/(app)/management/teams/_actions";
import { TeamMembersDialog } from "@/app/(app)/management/teams/team-members-dialog";
import type { Department } from "@/data/departments";

interface DepartmentsBoardProps {
  departments: Department[];
  rowCount: number;
  canManage: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
}

export const DepartmentsBoard = ({
  departments,
  rowCount,
  canManage,
  canDelete,
  canManageMembers,
}: DepartmentsBoardProps) => {
  const queryState = useDataTableQueryState({ defaultPageSize: 15, defaultSort: { id: "name", desc: false } });
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);
  // One dialog for the whole table rather than one per row: both entry points (the Members
  // count link and the row menu) open the same thing, and only one can be open at a time.
  const [membersTarget, setMembersTarget] = useState<Department | null>(null);

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
    () =>
      createDepartmentColumns({
        canManage,
        canDelete,
        canManageMembers,
        rowEditing,
        isSaving,
        onConfirmEdit: handleConfirmEdit,
        onManageMembers: setMembersTarget,
      }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, canDelete, canManageMembers, rowEditing.editingId, rowEditing.draft, isSaving]
  );

  return (
    <>
      <DataTable
        columns={departmentColumns}
        data={departments}
        queryState={queryState}
        rowCount={rowCount}
        enableColumnFilterRow={false}
        paginationLabel="departments"
      />
      {membersTarget ? (
        <TeamMembersDialog
          departmentId={membersTarget.id}
          departmentName={membersTarget.name}
          open
          onOpenChange={(open) => !open && setMembersTarget(null)}
        />
      ) : null}
    </>
  );
};
