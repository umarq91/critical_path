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
import { SeasonForm } from "@/app/(app)/seasons/season-form";
import { cn } from "@/lib/utils";

export const SeasonPageActions = ({ canCreateSeason }: { canCreateSeason: boolean }) => {
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
