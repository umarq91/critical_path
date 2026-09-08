"use client";

import { useState } from "react";
import { Info, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { ExternalUserForm } from "@/app/(app)/management/users/external-user-form";
import { PermissionsInfoDialog } from "@/app/(app)/management/users/permissions-info-dialog";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface UserPageActionsProps {
  departmentOptions: DataTableFilterOption[];
}

// Only external users are created here. Workspace staff appear automatically the first time
// they sign in with Google (the on_auth_user_created trigger), so there is nothing for an
// admin to create for them — only a role to adjust afterwards, which lives in the row menu.
export const UserPageActions = ({ departmentOptions }: UserPageActionsProps) => {
  const [open, setOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setPermissionsOpen(true)}>
        <Info />
        Role Permissions
      </Button>
      <PermissionsInfoDialog open={permissionsOpen} onOpenChange={setPermissionsOpen} />

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
    </div>
  );
};
