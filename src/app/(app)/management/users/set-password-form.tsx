"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { setExternalUserPassword } from "@/app/(app)/management/users/_actions";
import { setPasswordSchema, type SetPasswordInput } from "@/app/(app)/management/users/schema";

interface SetPasswordFormProps {
  userId: string;
  userLabel: string;
  onSuccess: () => void;
}

export const SetPasswordForm = ({ userId, userLabel, onSuccess }: SetPasswordFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(input: SetPasswordInput) {
    setIsSubmitting(true);
    const result = await setExternalUserPassword(userId, input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`New password set for ${userLabel}`);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField
          control={form.control}
          name="password"
          label="New password"
          type="password"
          description="At least 6 characters. Share it with them directly — this replaces their current one immediately."
        />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Saving…" : "Set Password"}
        </Button>
      </form>
    </Form>
  );
};
