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
import { DepartmentForm } from "@/app/(app)/departments/department-form";
import { cn } from "@/lib/utils";

export const DepartmentPageActions = ({ canCreateDepartment }: { canCreateDepartment: boolean }) => {
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
      {canCreateDepartment ? (
        <FormDialog
          title="Add Department"
          description="Create a new department tasks and users can be grouped under."
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus />
              Add Department
            </Button>
          }
        >
          <DepartmentForm onSuccess={() => setOpen(false)} />
        </FormDialog>
      ) : null}
    </>
  );
};
