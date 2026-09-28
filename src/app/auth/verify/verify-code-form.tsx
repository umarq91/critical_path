"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { ROUTES } from "@/constants/routes";
import {
  SIGN_IN_CODE_LENGTH,
  SIGN_IN_CODE_RESEND_COOLDOWN_SECONDS,
  SIGN_IN_SUPPORT_EMAIL,
} from "@/constants/sign-in-code";
import { signOut } from "@/app/auth/_actions";
import { sendSignInCodeAction, verifySignInCodeAction } from "@/app/auth/verify/_actions";
import { signInCodeSchema, type SignInCodeInput } from "@/app/auth/verify/schema";

const SEND_FAILED_MESSAGE = `We couldn't send your code. Try again, or contact ${SIGN_IN_SUPPORT_EMAIL}.`;

const VERIFY_ERROR_MESSAGES = {
  expired: "This code has expired. Send a new one.",
  no_code: "There's no active code for this sign-in. Send a new one.",
  busy: "Something went wrong checking that code. Try again.",
  malformed: `Enter the ${SIGN_IN_CODE_LENGTH}-digit code from the email.`,
} as const;

interface VerifyCodeFormProps {
  next: string;
  initialResendInSeconds: number;
}

export const VerifyCodeForm = ({ next, initialResendInSeconds }: VerifyCodeFormProps) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [resendInSeconds, setResendInSeconds] = useState(initialResendInSeconds);

  const form = useForm<SignInCodeInput>({
    resolver: zodResolver(signInCodeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (resendInSeconds <= 0) return;
    const timer = setTimeout(() => setResendInSeconds((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendInSeconds]);

  async function onSubmit(values: SignInCodeInput) {
    setIsVerifying(true);
    setError(null);
    const result = await verifySignInCodeAction(values);

    if (result.ok) {
      router.refresh();
      router.push(next);
      return;
    }

    setIsVerifying(false);
    if (result.reason === "locked") {
      router.replace(`${ROUTES.signIn}?error=code_locked`);
      return;
    }
    if (result.reason === "signed_out") {
      router.replace(ROUTES.signIn);
      return;
    }
    form.reset({ code: "" });
    setError(
      result.reason === "invalid"
        ? `That code isn't right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "attempt" : "attempts"} left before you're signed out.`
        : VERIFY_ERROR_MESSAGES[result.reason]
    );
  }

  async function onResend() {
    setIsSending(true);
    setError(null);
    const result = await sendSignInCodeAction();
    setIsSending(false);

    if (result.ok) {
      if (result.status === "not_required") {
        router.refresh();
        router.push(next);
        return;
      }
      form.reset({ code: "" });
      setResendInSeconds(SIGN_IN_CODE_RESEND_COOLDOWN_SECONDS);
      toast.success("A new code is on its way");
      return;
    }
    if (result.reason === "signed_out") {
      router.replace(ROUTES.signIn);
      return;
    }
    if (result.reason === "cooldown") {
      setResendInSeconds(result.resendInSeconds);
      return;
    }
    setError(SEND_FAILED_MESSAGE);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4 text-left">
          {error ? (
            <p className="rounded-md bg-status-overdue-soft px-3 py-2 text-center text-sm text-status-overdue-text">
              {error}
            </p>
          ) : null}
          <TextField
            control={form.control}
            name="code"
            label="Sign-in code"
            placeholder={"0".repeat(SIGN_IN_CODE_LENGTH)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={SIGN_IN_CODE_LENGTH}
          />
          <Button type="submit" size="lg" className="h-12 w-full text-base font-semibold" disabled={isVerifying}>
            {isVerifying ? "Checking…" : "Verify"}
          </Button>
        </form>
      </Form>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onResend} disabled={isSending || resendInSeconds > 0}>
          {resendInSeconds > 0 ? `Send a new code in ${resendInSeconds}s` : isSending ? "Sending…" : "Send a new code"}
        </Button>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
};
