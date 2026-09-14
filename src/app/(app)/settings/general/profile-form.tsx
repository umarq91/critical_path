"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/form-fields/text-field";
import { updateOwnProfile } from "@/app/(app)/settings/general/_actions";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/app/(app)/settings/general/schema";
import { ROLE_LABEL, type Role } from "@/constants/roles";

interface ProfileFormProps {
  fullName: string;
  email: string;
  role: Role;
  departmentName: string | null;
}

// Email, role, and department are rendered as disabled inputs rather than plain text — same
// visual weight as the editable field beside them, so "you can see this but not touch it" reads
// at a glance instead of needing a caption per field. They're not part of the form at all
// (no register, no schema key): see _actions.ts for why the database itself would reject an
// attempt to change them here.
export const ProfileForm = ({ fullName, email, role, departmentName }: ProfileFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { full_name: fullName },
  });

  async function onSubmit(input: ProfileUpdateInput) {
    setIsSubmitting(true);
    const result = await updateOwnProfile(input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Profile updated");
    form.reset(input);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="full_name" label="Name" placeholder="Jane Doe" />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} disabled readOnly />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-role">Role</Label>
          <Input id="profile-role" value={ROLE_LABEL[role]} disabled readOnly />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-department">Department</Label>
          <Input id="profile-department" value={departmentName ?? "No department"} disabled readOnly />
        </div>

        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Form>
  );
};
