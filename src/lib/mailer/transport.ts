import "server-only";
import nodemailer from "nodemailer";
import { getSmtpEnv } from "@/lib/env.server";

// One transport instance, created lazily on first send (not at module load, same reasoning as
// getServiceRoleKey/getSmtpEnv) and reused across calls within the same server process —
// nodemailer pools connections internally, so there's no benefit to a fresh transport per email.
let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

// Returns null when SMTP isn't configured yet (getSmtpEnv), rather than throwing — the relay
// is a separate provisioning step the client may not have finished; see send.ts for what a
// caller does with a null transport.
export function getMailTransport() {
  if (transport) return transport;

  const env = getSmtpEnv();
  if (!env) return null;

  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 is implicit TLS; every other port (587 included) starts plain and upgrades via
    // STARTTLS, which nodemailer does automatically when `secure` is false.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transport;
}
