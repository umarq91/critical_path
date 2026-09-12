import { NextResponse, type NextRequest } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { listDueReminders, recordReminderSent } from "@/data/reminders";
import { sendMail } from "@/lib/mailer/send";
import { taskReminderEmail } from "@/lib/mailer/templates/task-reminder";

// Triggered every 15 minutes by Supabase pg_cron/pg_net (not Vercel's own Cron — see
// things-to-know.md's Reminders section), guarded by CRON_SECRET the same way every other
// app/api/cron/* route is. Fetches every (rule, task, offset) reminder due right now
// (listDueReminders already excludes anything notifications_log says was already sent), sends
// each by email, and logs it. One failed send never blocks the rest of the batch.
//
// ⚠️ TEMPORARY: while SMTP_* is unset, a "skipped" reminder is logged to notifications_log
// anyway (see the comment at that call below) so it's visible in Supabase during testing.
// Remove that once real SMTP_* creds are in — see things-to-know.md's Reminders section.
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const due = await listDueReminders();

  let sent = 0;
  let failed = 0;
  let skippedNoSmtp = 0;
  for (const reminder of due) {
    try {
      const result = await sendMail(
        taskReminderEmail({
          to: reminder.profileEmail,
          taskName: reminder.taskName,
          dueDate: reminder.dueDate,
          seasonName: reminder.seasonName,
          offsetDays: reminder.offsetDays,
        })
      );

      if (!result.sent) {
        // TEMPORARY, while SMTP_* isn't configured yet: log this exact reminder to
        // notifications_log as if it sent, so its presence is verifiable in Supabase before
        // the real relay is wired up. Revert this back to a plain `continue` (no log write)
        // once SMTP_* is set — leaving it in place after that point means every reminder whose
        // SMTP send fails also gets silently marked "done" and never retried, which defeats
        // the whole point of the dedupe log. See things-to-know.md's Reminders section.
        skippedNoSmtp++;
        await recordReminderSent(reminder.ruleId, reminder.taskId, reminder.offsetDays);
        continue;
      }

      await recordReminderSent(reminder.ruleId, reminder.taskId, reminder.offsetDays);
      sent++;
    } catch {
      // A genuine send failure (relay rejected it, network error, etc.) is also left un-logged
      // — the next run (15 minutes later, still within the same matching hour) retries it
      // rather than silently dropping it for the day.
      failed++;
    }
  }

  return NextResponse.json({ matched: due.length, sent, failed, skippedNoSmtp });
}
