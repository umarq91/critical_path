"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { ExternalLinkForm } from "@/app/(app)/external-links/external-link-form";

// Renders nothing at all for a non-admin — the page is read-only for every other role, so
// there is no disabled affordance to explain.
export const ExternalLinkPageActions = ({ canManage }: { canManage: boolean }) => {
  const [open, setOpen] = useState(false);

  if (!canManage) return null;

  return (
    <FormDialog
      title="Add Link"
      description="Add an external resource the team should be able to reach from here."
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button>
          <Plus />
          Add Link
        </Button>
      }
    >
      <ExternalLinkForm onSuccess={() => setOpen(false)} />
    </FormDialog>
  );
};
