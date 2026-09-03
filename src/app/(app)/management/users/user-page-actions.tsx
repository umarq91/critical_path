"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { ExternalUserForm } from "@/app/(app)/management/users/external-user-form";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface UserPageActionsProps {
  departmentOptions: DataTableFilterOption[];
}

// Only external users are created here. Workspace staff appear automatically the first time
// they sign in with Google (the on_auth_user_created trigger), so there is nothing for an
// admin to create for them — only a role to adjust afterwards, which lives in the row menu.
export const UserPageActions = ({ departmentOptions }: UserPageActionsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <FormDialog
      title="Add External User"
      description="Creates a platform account for someone outside the company Google Workspace. They sign in with the email and password you set here."
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button>
          <UserPlus />
          Add External User
        </Button>
      }
    >
      <ExternalUserForm departmentOptions={departmentOptions} onSuccess={() => setOpen(false)} />
    </FormDialog>
  );
};
