"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteExternalLink } from "@/app/(app)/external-links/_actions";

export const ExternalLinkRowActions = ({ linkId, linkTitle }: { linkId: string; linkTitle: string }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    const result = await deleteExternalLink(linkId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${linkTitle} deleted`);
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
        title="Delete link"
        description={`This removes "${linkTitle}" from the list. It can be recovered from the database if needed.`}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
      />
    </div>
  );
};
