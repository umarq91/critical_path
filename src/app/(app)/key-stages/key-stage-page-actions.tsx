"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormDialog } from "@/components/shared/form-dialog";
import { KeyStageForm } from "@/app/(app)/key-stages/key-stage-form";
import { cn } from "@/lib/utils";

export const KeyStagePageActions = ({ canCreateKeyStage }: { canCreateKeyStage: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
          Export
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Export as CSV</DropdownMenuItem>
          <DropdownMenuItem>Export as PDF</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
