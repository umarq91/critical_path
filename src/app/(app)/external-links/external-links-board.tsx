"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createExternalLinkColumns } from "@/app/(app)/external-links/columns";
import { updateExternalLink } from "@/app/(app)/external-links/_actions";
import { EXTERNAL_LINKS_QUERY_STATE } from "@/app/(app)/external-links/query-state";
import type { ExternalLink } from "@/data/external-links";

interface ExternalLinksBoardProps {
  links: ExternalLink[];
  rowCount: number;
  canManage: boolean;
}

export const ExternalLinksBoard = ({ links, rowCount, canManage }: ExternalLinksBoardProps) => {
  const queryState = useDataTableQueryState(EXTERNAL_LINKS_QUERY_STATE);
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirmEdit(link: ExternalLink) {
    setIsSaving(true);
    const result = await updateExternalLink(link.id, rowEditing.draft);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${link.title} updated`);
    rowEditing.stopEditing();
  }

  const linkColumns = useMemo(
    () =>
      createExternalLinkColumns({
        canManage,
        canDelete: canManage,
        rowEditing,
        isSaving,
        onConfirmEdit: handleConfirmEdit,
      }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, rowEditing.editingId, rowEditing.draft, isSaving]
  );

  return (
    <DataTable
      columns={linkColumns}
      data={links}
      queryState={queryState}
      rowCount={rowCount}
      enableColumnFilterRow={false}
      paginationLabel="links"
    />
  );
};
