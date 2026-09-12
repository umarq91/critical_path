"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { KeyStageForm } from "@/app/(app)/key-stages/key-stage-form";
import { KeyStagesExportButton } from "@/app/(app)/key-stages/key-stages-export-button";

interface KeyStagePageActionsProps {
  canCreateKeyStage: boolean;
  canExport: boolean;
  rowCount: number;
}

export const KeyStagePageActions = ({ canCreateKeyStage, canExport, rowCount }: KeyStagePageActionsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {canExport ? <KeyStagesExportButton rowCount={rowCount} /> : null}
      {canCreateKeyStage ? (
        <FormDialog
          title="Add Key Stage"
          description="Create a new key stage tasks can be grouped under."
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus />
              Add Key Stage
            </Button>
          }
        >
          <KeyStageForm onSuccess={() => setOpen(false)} />
        </FormDialog>
      ) : null}
    </>
  );
};
