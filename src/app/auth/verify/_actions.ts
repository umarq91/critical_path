"use server";

import { sendSignInCode, verifySignInCode } from "@/lib/sign-in-code";
import { signInCodeSchema } from "@/app/auth/verify/schema";

export async function sendSignInCodeAction() {
  return sendSignInCode();
}

export async function verifySignInCodeAction(input: unknown) {
  const parsed = signInCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: "malformed" as const };
  return verifySignInCode(parsed.data.code);
}
