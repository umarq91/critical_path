"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { SelectField } from "@/components/form-fields/select-field";
import { updateUser } from "@/app/(app)/management/users/_actions";
import { userUpdateSchema, type UserUpdateInput } from "@/app/(app)/management/users/schema";
import { ROLE, ROLE_LABEL, WORKSPACE_ROLES } from "@/constants/roles";
import type { ManagedUser } from "@/data/users";

const NO_DEPARTMENT = "none";

const ROLE_OPTIONS = WORKSPACE_ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }));

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

interface UserFormProps {
  user: ManagedUser;
  departmentOptions: { value: string; label: string }[];
  isCurrentUser: boolean;
  onSuccess: () => void;
}

export const UserForm = ({ user, departmentOptions, isCurrentUser, onSuccess }: UserFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isExternal = user.role === ROLE.EXTERNAL;

  // role/status are omitted from the form entirely — not merely hidden — when they can't be
  // changed, so an unrendered field can't submit its default value and trip the server's own
  // rejection. An admin editing themselves would otherwise always get "You can't change your
  // own role or status" for an edit that only touched their name.
  const canEditRole = !isExternal && !isCurrentUser;
  const canEditStatus = !isCurrentUser;

  const form = useForm<UserUpdateInput>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      full_name: user.full_name ?? "",
      department_id: user.department_id ?? NO_DEPARTMENT,
      ...(canEditRole ? { role: user.role as (typeof WORKSPACE_ROLES)[number] } : {}),
      ...(canEditStatus ? { status: user.status === "inactive" ? ("inactive" as const) : ("active" as const) } : {}),
    },
  });

  async function onSubmit(input: UserUpdateInput) {
    setIsSubmitting(true);
    const result = await updateUser(user.id, input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${input.full_name ?? user.email} updated`);
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="full_name" label="Name" placeholder="Jane Doe" />
        <SelectField
          control={form.control}
          name="department_id"
          label="Department"
          options={[{ value: NO_DEPARTMENT, label: "No department" }, ...departmentOptions]}
        />
        {/* An external account's role is fixed: it authenticates with a password and has no
            Workspace identity, so there is nothing to promote it to. The server rejects the
            change independently — hiding the control is the explanation, not the guard. */}
        {isExternal ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            External users keep the External role. To give this person internal access, create a
            Google Workspace account for them instead.
          </p>
        ) : null}
        {canEditRole ? (
          <SelectField control={form.control} name="role" label="Role" options={ROLE_OPTIONS} />
        ) : null}
        {canEditStatus ? (
          <SelectField
            control={form.control}
            name="status"
            label="Status"
            options={STATUS_OPTIONS}
            description="Deactivating revokes access to every task, list and page immediately."
          />
        ) : null}
        {isCurrentUser ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            You can&apos;t change your own role or status — an admin who demotes themselves can
            lock everyone out of user management.
          </p>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
};
