"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteDepartment } from "@/app/(app)/departments/_actions";

export const DepartmentRowActions = ({
  departmentId,
  departmentName,
}: {
  departmentId: string;
  departmentName: string;
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    const result = await deleteDepartment(departmentId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${departmentName} deleted`);
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
        title="Delete department"
        description={`This removes "${departmentName}" from the list. Any tasks or users assigned to it will be left with no department. It can be recovered from the database if needed.`}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
      />
    </div>
  );
};
