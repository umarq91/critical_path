"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { createBrandColumns } from "@/app/(app)/brands/columns";
import { updateBrand } from "@/app/(app)/brands/_actions";
import { BRAND_STATUS_CONFIG } from "@/constants/brand-status";
import type { Brand } from "@/data/brands";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface BrandsBoardProps {
  brands: Brand[];
  rowCount: number;
  canManage: boolean;
  canDelete: boolean;
  seasonOptions: DataTableFilterOption[];
}

export const BrandsBoard = ({ brands, rowCount, canManage, canDelete, seasonOptions }: BrandsBoardProps) => {
  const queryState = useDataTableQueryState({ defaultPageSize: 10, defaultSort: { id: "brand_name", desc: false } });
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirmEdit(brand: Brand) {
    setIsSaving(true);
    const result = await updateBrand(brand.id, rowEditing.draft);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${brand.brand_name} updated`);
    rowEditing.stopEditing();
  }

  const brandColumns = useMemo(
    () => createBrandColumns({ canManage, canDelete, rowEditing, isSaving, onConfirmEdit: handleConfirmEdit }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, canDelete, rowEditing.editingId, rowEditing.draft, isSaving]
  );

  return (
    <DataTable
      columns={brandColumns}
      data={brands}
      queryState={queryState}
      rowCount={rowCount}
      enableColumnFilterRow={false}
      paginationLabel="brands"
      toolbar={{
        filters: [
          {
            columnId: "status",
            title: "Status",
            placeholder: "Status",
            options: Object.entries(BRAND_STATUS_CONFIG).map(([value, { label }]) => ({ value, label })),
          },
          { columnId: "season_id", title: "Season", placeholder: "Season", options: seasonOptions },
        ],
        sortOptions: [
          { columnId: "brand_name", desc: false, label: "Brand Name (A-Z)" },
          { columnId: "brand_name", desc: true, label: "Brand Name (Z-A)" },
          { columnId: "created_at", desc: true, label: "Created On (Newest)" },
          { columnId: "created_at", desc: false, label: "Created On (Oldest)" },
        ],
        searchColumnId: "brand_name",
        searchPlaceholder: "Search brands...",
      }}
    />
  );
};
