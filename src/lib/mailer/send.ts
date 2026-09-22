import "server-only";
import { getMailTransport } from "@/lib/mailer/transport";
import { getSmtpEnv } from "@/lib/env.server";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// The one function that calls transport.sendMail — every email template (just taskReminder for
// now) builds an EmailMessage and hands it here, so the "from" address and the actual send call
// exist in exactly one place.
//
// `sent: false` (SMTP not yet configured) is a distinct outcome from a thrown error (a real
// send failure): callers that log a dedupe record on success — recordReminderSent — must only
// do so for an actual send, never for "not configured", or a reminder would be silently marked
// done and never retried once the relay is finally set up. See things-to-know.md's Reminders
// section.
export async function sendMail(message: EmailMessage): Promise<{ sent: boolean }> {
  const env = getSmtpEnv();
  const transport = getMailTransport();
  if (!env || !transport) return { sent: false };

  await transport.sendMail({
    from: env.SMTP_FROM_NAME ? `"${env.SMTP_FROM_NAME}" <${env.SMTP_USER}>` : env.SMTP_USER,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  return { sent: true };
}
