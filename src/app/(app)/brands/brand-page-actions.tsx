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
import { BrandForm } from "@/app/(app)/brands/brand-form";
import { cn } from "@/lib/utils";
import type { listSeasonOptions } from "@/data/seasons";

interface BrandPageActionsProps {
  canCreateBrand: boolean;
  seasonOptions: Awaited<ReturnType<typeof listSeasonOptions>>;
}

export const BrandPageActions = ({ canCreateBrand, seasonOptions }: BrandPageActionsProps) => {
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
          <BrandForm onSuccess={() => setOpen(false)} seasonOptions={seasonOptions} />
        </FormDialog>
      ) : null}
    </>
  );
};
