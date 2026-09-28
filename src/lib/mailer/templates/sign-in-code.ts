import "server-only";
import { SIGN_IN_CODE_TTL_MINUTES, SIGN_IN_SUPPORT_EMAIL } from "@/constants/sign-in-code";
import type { EmailMessage } from "@/lib/mailer/send";

export function signInCodeEmail({ to, code }: { to: string; code: string }): EmailMessage {
  const subject = "Your Critical Path sign-in code";
  const warning = `If you didn't just try to sign in, someone may know your password. Contact ${SIGN_IN_SUPPORT_EMAIL}.`;
  const text = [
    `Your Critical Path sign-in code is ${code}`,
    "",
    `It expires in ${SIGN_IN_CODE_TTL_MINUTES} minutes.`,
    "",
    warning,
  ].join("\n");
  const html = `
    <p>Your Critical Path sign-in code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
    <p>It expires in ${SIGN_IN_CODE_TTL_MINUTES} minutes.</p>
    <p style="color:#6b7280">${warning}</p>
  `.trim();

  return { to, subject, html, text };
}
