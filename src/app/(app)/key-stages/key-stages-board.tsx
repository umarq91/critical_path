"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createKeyStageColumns } from "@/app/(app)/key-stages/columns";
import { updateKeyStage } from "@/app/(app)/key-stages/_actions";
import type { KeyStage } from "@/data/key-stages";

interface KeyStagesBoardProps {
  keyStages: KeyStage[];
  rowCount: number;
  canManage: boolean;
  canDelete: boolean;
}

export const KeyStagesBoard = ({ keyStages, rowCount, canManage, canDelete }: KeyStagesBoardProps) => {
  const queryState = useDataTableQueryState({ defaultPageSize: 15, defaultSort: { id: "name", desc: false } });
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirmEdit(keyStage: KeyStage) {
    setIsSaving(true);
    const result = await updateKeyStage(keyStage.id, rowEditing.draft);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${keyStage.name} updated`);
    rowEditing.stopEditing();
  }

  const keyStageColumns = useMemo(
    () => createKeyStageColumns({ canManage, canDelete, rowEditing, isSaving, onConfirmEdit: handleConfirmEdit }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, canDelete, rowEditing.editingId, rowEditing.draft, isSaving]
  );

  return (
    <DataTable
      columns={keyStageColumns}
      data={keyStages}
      queryState={queryState}
      rowCount={rowCount}
      enableColumnFilterRow={false}
      paginationLabel="key stages"
    />
  );
};
