"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { BrandForm } from "@/app/(app)/brands/brand-form";
import { BrandsExportButton } from "@/app/(app)/brands/brands-export-button";

interface BrandPageActionsProps {
  canCreateBrand: boolean;
  canExport: boolean;
  rowCount: number;
}

export const BrandPageActions = ({ canCreateBrand, canExport, rowCount }: BrandPageActionsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {canExport ? <BrandsExportButton rowCount={rowCount} /> : null}
      {canCreateBrand ? (
        <FormDialog
          title="Add New Brand"
          description="Create a new brand to organise tasks under."
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus />
              Add New Brand
            </Button>
          }
        >
          <BrandForm onSuccess={() => setOpen(false)} />
        </FormDialog>
      ) : null}
    </>
  );
};
