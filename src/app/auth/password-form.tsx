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
import { isBannedError } from "@/lib/auth-errors";
import { isExternalRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { SIGN_IN_SUPPORT_EMAIL } from "@/constants/sign-in-code";
import { sendSignInCodeAction } from "@/app/auth/verify/_actions";

const DEACTIVATED_MESSAGE = "Unable to log in, please contact techsupport@threebyone.com.au";

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
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setIsSubmitting(false);
      // A banned account is a deactivated one, and saying so is not an enumeration leak: the
      // person already proved they know the password. Everything else gets the vague message
      // on purpose — Supabase distinguishes "no such user" from "wrong password", which would
      // otherwise turn this form into an account-enumeration oracle.
      setError(
        isBannedError(signInError)
          ? DEACTIVATED_MESSAGE
          : "That email and password combination doesn't match an account."
      );
      return;
    }

    // Backstop for accounts deactivated before deactivation started banning them at the auth
    // layer — those still authenticate successfully, so the session has to be thrown away
    // here. Reading your own profile is always permitted, deactivated or not.
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("id", data.user.id)
      .single();

    if (profile?.status !== "active") {
      await supabase.auth.signOut();
      setIsSubmitting(false);
      setError(DEACTIVATED_MESSAGE);
      return;
    }

    // External accounts owe an emailed code before RLS will return any data (0032). Sent from
    // here rather than on /auth/verify's render, so a send failure stops sign-in on this form.
    if (isExternalRole(profile.role)) {
      const sendResult = await sendSignInCodeAction().catch(() => null);
      if (!sendResult || (!sendResult.ok && sendResult.reason !== "cooldown")) {
        await supabase.auth.signOut();
        setIsSubmitting(false);
        setError(`We couldn't send your sign-in code. Try again, or contact ${SIGN_IN_SUPPORT_EMAIL}.`);
        return;
      }
      router.push(`${ROUTES.verifySignIn}?next=${encodeURIComponent(next)}`);
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
