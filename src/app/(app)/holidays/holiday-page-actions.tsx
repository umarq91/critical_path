"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { HolidayForm } from "@/app/(app)/holidays/holiday-form";
import { CsvBulkImport } from "@/app/(app)/holidays/csv-bulk-import";

interface HolidayPageActionsProps {
  canManage: boolean;
}

export const HolidayPageActions = ({ canManage }: HolidayPageActionsProps) => {
  const [open, setOpen] = useState(false);

  if (!canManage) return null;

  return (
    <>
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
