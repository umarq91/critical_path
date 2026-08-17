"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteTask } from "@/app/(app)/tasks/_actions";

export const TaskRowActions = ({ taskId, taskName }: { taskId: string; taskName: string }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    const result = await deleteTask(taskId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${taskName} deleted`);
  }

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        title="Delete task"
        description={`This removes "${taskName}" from the list. It can be recovered from the database if needed.`}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
      />
    </div>
  );
};
