"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { HolidayForm } from "@/app/(app)/holidays/holiday-form";
import { CsvBulkImport } from "@/app/(app)/holidays/csv-bulk-import";
import { HolidaysExportButton } from "@/app/(app)/holidays/holidays-export-button";

interface HolidayPageActionsProps {
  canManage: boolean;
  canExport: boolean;
  rowCount: number;
  countries: string[];
}

export const HolidayPageActions = ({ canManage, canExport, rowCount, countries }: HolidayPageActionsProps) => {
  const [open, setOpen] = useState(false);

  if (!canManage) return canExport ? <HolidaysExportButton rowCount={rowCount} countries={countries} /> : null;

  return (
    <>
      {canExport ? <HolidaysExportButton rowCount={rowCount} countries={countries} /> : null}
      <CsvBulkImport />
      <FormDialog
        title="Add Holiday"
        description="Add a single public holiday."
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button>
            <Plus />
            Add Holiday
          </Button>
        }
      >
        <HolidayForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
};
