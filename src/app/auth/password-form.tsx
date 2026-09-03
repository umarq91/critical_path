"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { createClient } from "@/lib/supabase/client";
import { passwordSignInSchema, type PasswordSignInInput } from "@/app/auth/schema";

// Email + password sign-in, for external platform users an admin created (see
// management/users). Google Workspace staff use the Google button above this and never have
// a password set at all.
//
// Supabase Auth owns the credential end to end — this posts to Supabase, which verifies its
// own hash. No password ever reaches our own tables, and there is no plaintext to store.
export const PasswordForm = ({ next }: { next: string }) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordSignInInput>({
    resolver: zodResolver(passwordSignInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit({ email, password }: PasswordSignInInput) {
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setIsSubmitting(false);
      // Deliberately not echoing Supabase's message: it distinguishes "no such user" from
      // "wrong password", which turns the form into an account-enumeration oracle.
      setError("That email and password combination doesn't match an account.");
      return;
    }

    // The session cookie is set by the browser client; refresh() re-runs the Server
    // Components (and the (app) layout's profile guard) against the new session before the
    // push lands, so the destination renders as the signed-in user on first paint.
    router.refresh();
    router.push(next);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4 text-left">
        {error ? (
          <p className="rounded-md bg-status-overdue-soft px-3 py-2 text-center text-sm text-status-overdue-text">
            {error}
          </p>
        ) : null}
        <TextField control={form.control} name="email" label="Email" type="email" placeholder="you@example.com" />
        <TextField control={form.control} name="password" label="Password" type="password" placeholder="••••••••" />
        <Button type="submit" size="lg" className="h-12 w-full text-base font-semibold" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Form>
  );
};
