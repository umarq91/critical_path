import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServiceRoleKey } from "@/lib/env.server";
import { sendMail } from "@/lib/mailer/send";
import { signInCodeEmail } from "@/lib/mailer/templates/sign-in-code";
import {
  SIGN_IN_CODE_LENGTH,
  SIGN_IN_CODE_MAX_ATTEMPTS,
  SIGN_IN_CODE_RESEND_COOLDOWN_SECONDS,
  SIGN_IN_CODE_TTL_MINUTES,
} from "@/constants/sign-in-code";

// Email sign-in code for external accounts. See things-to-know.md § Accounts for the model: one
// `session_verifications` row per Supabase session, and is_active_user() (RLS) refuses an
// external session until that row is verified.
//
// session_verifications has no RLS policies, so every read and write here goes through the
// service-role client. That's the point rather than a shortcut — a user must never be able to
// mark their own session verified. Identity and session id always come from the caller's own
// verified token (getClaims), never from input.

type SignInCodeSession =
  | { kind: "signed_out" }
  | { kind: "not_required" }
  | { kind: "required"; userId: string; sessionId: string; email: string };

async function resolveSession(): Promise<SignInCodeSession> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !claims.session_id) return { kind: "signed_out" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, email")
    .eq("id", claims.sub)
    .single();
  // A deactivated external account is handled by the deactivated notice, not by a code.
  if (!profile || profile.role !== "external" || profile.status !== "active") return { kind: "not_required" };

  return { kind: "required", userId: claims.sub, sessionId: claims.session_id, email: profile.email };
}

function hashCode(sessionId: string, code: string) {
  return createHmac("sha256", getServiceRoleKey()).update(`${sessionId}:${code}`).digest("hex");
}

function readVerification(sessionId: string) {
  return createAdminClient()
    .from("session_verifications")
    .select("code_hash, code_sent_at, code_expires_at, failed_attempts, verified_at")
    .eq("session_id", sessionId)
    .maybeSingle();
}

function secondsUntilResend(codeSentAt: string | null) {
  if (!codeSentAt) return 0;
  const elapsed = (Date.now() - new Date(codeSentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(SIGN_IN_CODE_RESEND_COOLDOWN_SECONDS - elapsed));
}

export type SignInCodeState =
  | { kind: "signed_out" }
  | { kind: "not_required" }
  | { kind: "pending"; email: string; resendInSeconds: number; hasLiveCode: boolean };

// For the /auth/verify page: does this session still owe a code, and how long until "Send a new
// code" unlocks.
export async function getSignInCodeState(): Promise<SignInCodeState> {
  const session = await resolveSession();
  if (session.kind !== "required") return session;

  const { data: row } = await readVerification(session.sessionId);
  if (row?.verified_at) return { kind: "not_required" };
  const hasLiveCode = !!row?.code_hash && !!row.code_expires_at && new Date(row.code_expires_at).getTime() > Date.now();
  return {
    kind: "pending",
    email: session.email,
    resendInSeconds: secondsUntilResend(row?.code_sent_at ?? null),
    hasLiveCode,
  };
}

export type SendSignInCodeResult =
  | { ok: true; status: "sent" | "not_required" }
  | { ok: false; reason: "signed_out" | "send_failed" }
  | { ok: false; reason: "cooldown"; resendInSeconds: number };

export async function sendSignInCode(): Promise<SendSignInCodeResult> {
  const session = await resolveSession();
  if (session.kind === "signed_out") return { ok: false, reason: "signed_out" };
  if (session.kind === "not_required") return { ok: true, status: "not_required" };

  const { data: row } = await readVerification(session.sessionId);
  if (row?.verified_at) return { ok: true, status: "not_required" };

  const resendInSeconds = secondsUntilResend(row?.code_sent_at ?? null);
  if (resendInSeconds > 0) return { ok: false, reason: "cooldown", resendInSeconds };

  const code = randomInt(0, 10 ** SIGN_IN_CODE_LENGTH).toString().padStart(SIGN_IN_CODE_LENGTH, "0");
  const now = new Date();
  const admin = createAdminClient();
  // failed_attempts is deliberately not in this upsert: a new code keeps the sign-in's count.
  const { error } = await admin.from("session_verifications").upsert({
    session_id: session.sessionId,
    user_id: session.userId,
    code_hash: hashCode(session.sessionId, code),
    code_sent_at: now.toISOString(),
    code_expires_at: new Date(now.getTime() + SIGN_IN_CODE_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) return { ok: false, reason: "send_failed" };

  let sent = false;
  try {
    ({ sent } = await sendMail(signInCodeEmail({ to: session.email, code })));
  } catch {
    sent = false;
  }
  if (!sent) {
    // Clear the code and the cooldown so "Try again" works straight away.
    await admin
      .from("session_verifications")
      .update({ code_hash: null, code_sent_at: null, code_expires_at: null })
      .eq("session_id", session.sessionId);
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true, status: "sent" };
}

export type VerifySignInCodeResult =
  | { ok: true }
  | { ok: false; reason: "signed_out" | "no_code" | "expired" | "locked" | "busy" }
  | { ok: false; reason: "invalid"; attemptsLeft: number };

export async function verifySignInCode(code: string): Promise<VerifySignInCodeResult> {
  const session = await resolveSession();
  if (session.kind === "signed_out") return { ok: false, reason: "signed_out" };
  if (session.kind === "not_required") return { ok: true };

  const { data: row } = await readVerification(session.sessionId);
  if (row?.verified_at) return { ok: true };
  if (!row?.code_hash || !row.code_expires_at) return { ok: false, reason: "no_code" };
  if (new Date(row.code_expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  const admin = createAdminClient();
  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(session.sessionId, code), "hex");
  if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
    await admin
      .from("session_verifications")
      .update({ verified_at: new Date().toISOString(), code_hash: null, code_expires_at: null })
      .eq("session_id", session.sessionId);
    return { ok: true };
  }

  const attempts = row.failed_attempts + 1;
  // Conditional on the count we read, so two wrong guesses racing each other can't both land on
  // the same number and buy an extra attempt. The loser is told to try again.
  const { data: updated } = await admin
    .from("session_verifications")
    .update({ failed_attempts: attempts })
    .eq("session_id", session.sessionId)
    .eq("failed_attempts", row.failed_attempts)
    .select("session_id");
  if (!updated?.length) return { ok: false, reason: "busy" };

  if (attempts >= SIGN_IN_CODE_MAX_ATTEMPTS) {
    // Ends the Supabase session; auth.sessions' cascade removes the verification row with it.
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { ok: false, reason: "locked" };
  }
  return { ok: false, reason: "invalid", attemptsLeft: SIGN_IN_CODE_MAX_ATTEMPTS - attempts };
}
