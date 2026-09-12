"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { SeasonForm } from "@/app/(app)/seasons/season-form";
import { SeasonsExportButton } from "@/app/(app)/seasons/seasons-export-button";

interface SeasonPageActionsProps {
  canCreateSeason: boolean;
  canExport: boolean;
  rowCount: number;
}

export const SeasonPageActions = ({ canCreateSeason, canExport, rowCount }: SeasonPageActionsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {canExport ? <SeasonsExportButton rowCount={rowCount} /> : null}
      {canCreateSeason ? (
        <FormDialog
          title="Add Season"
          description="Create a new season to organise tasks and brands under. You'll be set as its owner."
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus />
              Add Season
            </Button>
          }
        >
          <SeasonForm onSuccess={() => setOpen(false)} />
        </FormDialog>
      ) : null}
    </>
  );
};
