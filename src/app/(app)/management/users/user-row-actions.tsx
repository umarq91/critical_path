"use client";

import { useState } from "react";
import { MoreVertical, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormDialog } from "@/components/shared/form-dialog";
import { UserForm } from "@/app/(app)/management/users/user-form";
import { SetPasswordForm } from "@/app/(app)/management/users/set-password-form";
import { deleteUser, setUserStatus } from "@/app/(app)/management/users/_actions";
import { ROLE } from "@/constants/roles";
import type { ManagedUser } from "@/data/users";

interface UserRowActionsProps {
  user: ManagedUser;
  departmentOptions: { value: string; label: string }[];
  isCurrentUser: boolean;
}

export const UserRowActions = ({ user, departmentOptions, isCurrentUser }: UserRowActionsProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const label = user.full_name ?? user.email;
  const isExternal = user.role === ROLE.EXTERNAL;
  const isActive = user.status === "active";

  async function handleToggleStatus() {
    const result = await setUserStatus(user.id, isActive ? "inactive" : "active");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isActive ? `${label} deactivated` : `${label} reactivated`);
  }

  async function handleDelete() {
    const result = await deleteUser(user.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${label} deleted`);
  }

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit user</DropdownMenuItem>
          {/* Only external accounts have a password at all — a Workspace user's credential
              lives with Google. The action refuses the same call server-side. */}
          {isExternal ? (
            <DropdownMenuItem onClick={() => setPasswordOpen(true)}>Set password</DropdownMenuItem>
          ) : null}
          {isCurrentUser ? null : (
            <DropdownMenuItem
              variant={isActive ? "destructive" : undefined}
              onClick={() => setStatusConfirmOpen(true)}
            >
              {isActive ? "Deactivate" : "Reactivate"}
            </DropdownMenuItem>
          )}
          {isCurrentUser || isActive ? null : (
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
              Delete user
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <FormDialog
        title={`Edit ${label}`}
        description="Change this person's name, department, role or account status."
        open={editOpen}
        onOpenChange={setEditOpen}
      >
        <UserForm
          user={user}
          departmentOptions={departmentOptions}
          isCurrentUser={isCurrentUser}
          onSuccess={() => setEditOpen(false)}
        />
      </FormDialog>

      <FormDialog
        title={`Set password for ${label}`}
        description="Replaces their current password immediately. There is no reset email — pass the new one on directly."
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        size="sm"
      >
        <SetPasswordForm userId={user.id} userLabel={label} onSuccess={() => setPasswordOpen(false)} />
      </FormDialog>

      <ConfirmDialog
        title={isActive ? "Deactivate user" : "Reactivate user"}
        description={
          isActive
            ? `${label} will immediately lose access to every task, list and page. Their account and task history are kept, and you can reactivate them at any time.`
            : `${label} will be able to sign in and see their tasks again.`
        }
        confirmLabel={isActive ? "Deactivate" : "Reactivate"}
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        onConfirm={handleToggleStatus}
      />

      <ConfirmDialog
        title="Delete user"
        description={`${label} will be permanently deleted. Their tasks stay.`}
        confirmLabel="Delete"
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDelete}
      >
        <Alert className="border-status-overdue-base bg-status-overdue-soft text-status-overdue-text">
          <TriangleAlert />
          <AlertTitle>This can&apos;t be undone</AlertTitle>
          <AlertDescription className="text-status-overdue-text">
            They&apos;re removed as owner or involved person on every task, and anything they created
            or edited will show no name. Reactivating is no longer possible.
          </AlertDescription>
        </Alert>
      </ConfirmDialog>
    </div>
  );
};
