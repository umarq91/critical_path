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
import { TaskForm } from "@/app/(app)/tasks/task-form";
import { cn } from "@/lib/utils";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface TaskPageActionsProps {
  canCreateTask: boolean;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
}

export const TaskPageActions = ({
  canCreateTask,
  seasonOptions,
  brandOptions,
  keyStageOptions,
}: TaskPageActionsProps) => {
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
      {canCreateTask ? (
        <FormDialog
          title="Add New Task"
          description="Create a new task to track."
          size="xl"
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus />
              Add New Task
            </Button>
          }
        >
          <TaskForm
            onSuccess={() => setOpen(false)}
            seasonOptions={seasonOptions}
            brandOptions={brandOptions}
            keyStageOptions={keyStageOptions}
          />
        </FormDialog>
      ) : null}
    </>
  );
};
